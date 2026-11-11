const crypto = require('crypto');
const axios = require('axios');
const https = require('https');
const db = require('./db');

// 🚀 High-concurrency persistent HTTPS Agent (re-uses TCP/TLS connections for 1000+ simultaneous requests)
const ebHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 1000,
  maxFreeSockets: 300,
  timeout: 35000,
  freeSocketTimeout: 15000
});

const RNE_PUBLIC_KEY = "MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKoR8mX0rGKLqzcWmOzbfj64K8ZIgOdHnzkXSOVOZbFu/TJhZ7rFAN+eaGkl3C4buccQd/EjEsj9ir7ijT7h96MCAwEAAQ==";
const CLIENT_ID = "209ef407810e3856f40870a9f0e769d7";
const MASTER_USERNAME = "8801729261421";
const MASTER_PASSWORD = "Khalid@86";

function getConfig(key) {
  const configs = db.get('system_config').value();
  return configs ? configs[key] : null;
}

function setConfig(key, value) {
  db.set(`system_config.${key}`, value).write();
}

function generateAesKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "";
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

function encryptAesKeyWithRsa(aesKeyStr) {
  const aesKeyB64 = Buffer.from(aesKeyStr, 'utf8').toString('base64');
  const pubPem = `-----BEGIN PUBLIC KEY-----\n${RNE_PUBLIC_KEY}\n-----END PUBLIC KEY-----`;
  const encryptedBuf = crypto.publicEncrypt(
    {
      key: pubPem,
      padding: crypto.constants.RSA_PKCS1_PADDING
    },
    Buffer.from(aesKeyB64, 'utf8')
  );
  return encryptedBuf.toString('base64');
}

function encryptPayloadAes(jsonStr, aesKeyStr) {
  const cipher = crypto.createCipheriv('aes-256-ecb', Buffer.from(aesKeyStr, 'utf8'), null);
  cipher.setAutoPadding(true);
  let encrypted = cipher.update(jsonStr, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

/**
 * Automatically authenticates with EarnBondhu and saves fresh token
 * Supports promise sharing for concurrency (5-10 users simultaneously) and auto-failover
 */
let activeLoginPromise = null;

async function registerNewMasterAccount() {
  try {
    const aesKeyStr = generateAesKey();
    const encryptedKeyHeader = encryptAesKeyWithRsa(aesKeyStr);
    const randomPhone = '88019' + Math.floor(10000000 + Math.random() * 90000000);
    const randomPwd = 'EarnPulse@' + Math.floor(1000 + Math.random() * 9000);

    const payloadObj = {
      tenantId: "000000",
      username: randomPhone,
      password: randomPwd,
      confirmPassword: randomPwd,
      grantType: "password",
      clientId: CLIENT_ID,
      userType: "web_user"
    };
    const encryptedData = encryptPayloadAes(JSON.stringify(payloadObj), aesKeyStr);

    const headers = {
      'Content-Type': 'application/json;charset=utf-8',
      'clientid': CLIENT_ID,
      'encrypt-key': encryptedKeyHeader,
      'isToken': 'false',
      'repeatSubmit': 'false',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://earnbondhu.com/register',
      'Origin': 'https://earnbondhu.com'
    };

    const res = await axios.post('https://earnbondhu.com/prod-api/auth/register', encryptedData, { headers, timeout: 15000 });
    if (res.data && res.data.code === 200) {
      console.log(`[EarnBondhu Bridge] Successfully auto-registered fresh bridge master account: ${randomPhone}`);
      const currentConfig = db.get('system_config').value() || {};
      db.set('system_config', {
        ...currentConfig,
        master_username: randomPhone,
        master_password: randomPwd,
        config_updated_at: Date.now()
      }).write();
      return { username: randomPhone, password: randomPwd };
    }
  } catch (err) {
    console.error('[EarnBondhu Bridge] Auto-registration failed:', err.response?.data || err.message);
  }
  return null;
}

let lastUnauthDetectedTime = 0;
const ADMIN_LOGIN_COOLDOWN_MS = 60 * 1000; // 60 seconds (1 minute) cooldown so admin can withdraw on phone without session conflict

function recordUnauthDetected() {
  lastUnauthDetectedTime = Date.now();
  console.log('⚠️ [EarnBondhu Bridge] 401 detected. Entering 60s (1 min) cooldown to allow Admin phone withdrawal.');
}

function isLoginCooldownActive() {
  return (Date.now() - lastUnauthDetectedTime) < ADMIN_LOGIN_COOLDOWN_MS;
}

// In-memory cache for recent active pairing codes (prevents upstream throttling and gives instant response to users)
const activePairingCodeCache = new Map(); // phone -> { code, timestamp }

async function autoLoginEarnBondhu(forceNew = false) {
  if (isLoginCooldownActive() && !forceNew) {
    console.log('[EarnBondhu Bridge] Admin withdrawal session active on phone. Skipping auto-login.');
    return null;
  }
  if (activeLoginPromise && !forceNew) {
    return activeLoginPromise;
  }
  activeLoginPromise = (async () => {
    try {
      // The authentic master account for all WhatsApp connections
      const uName = MASTER_USERNAME;
      const uPwd = MASTER_PASSWORD;

      console.log(`[EarnBondhu Bridge] Logging in as ${uName}...`);
      const aesKeyStr = generateAesKey();
      const encryptedKeyHeader = encryptAesKeyWithRsa(aesKeyStr);
      const payloadObj = {
        tenantId: "000000",
        username: uName,
        password: uPwd,
        grantType: "password",
        clientId: CLIENT_ID
      };
      const encryptedData = encryptPayloadAes(JSON.stringify(payloadObj), aesKeyStr);

      const headers = {
        'Content-Type': 'application/json;charset=utf-8',
        'clientid': CLIENT_ID,
        'encrypt-key': encryptedKeyHeader,
        'isToken': 'false',
        'repeatSubmit': 'false',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://earnbondhu.com/login',
        'Origin': 'https://earnbondhu.com'
      };

      const res = await axios.post('https://earnbondhu.com/prod-api/auth/login', encryptedData, { headers, timeout: 15000 });
      if (res.data && res.data.code === 200 && res.data.data?.access_token) {
        const newToken = res.data.data.access_token;
        const now = Date.now();
        const currentConfig = db.get('system_config').value() || {};
        const updatedConfig = {
          ...currentConfig,
          master_target_token: newToken,
          master_username: uName,
          master_password: uPwd,
          config_updated_at: now
        };
        db.set('system_config', updatedConfig).write();
        console.log('[EarnBondhu Bridge] Successfully refreshed master token!');

        if (db.syncToCloud) {
          setImmediate(() => { db.syncToCloud(false).catch(() => {}); });
        }
        return newToken;
      } else {
        console.error('[EarnBondhu Bridge] Login response error:', res.data);
        if (!forceNew) {
          return autoLoginEarnBondhu(true);
        }
        return null;
      }
    } catch (err) {
      console.error('[EarnBondhu Bridge] Login exception:', err.response?.data || err.message);
      if (!forceNew) {
        return autoLoginEarnBondhu(true);
      }
      return null;
    } finally {
      activeLoginPromise = null;
    }
  })();
  return activeLoginPromise;
}

function getEarnBondhuClient(customToken = null) {
  const baseURL = getConfig('target_base_url') || 'https://earnbondhu.com';
  const clientId = getConfig('target_client_id') || CLIENT_ID;
  const token = customToken || getConfig('master_target_token') || '';

  const headers = {
    'Content-Type': 'application/json;charset=utf-8',
    'clientid': clientId,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://earnbondhu.com/',
    'Origin': 'https://earnbondhu.com'
  };

  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  return axios.create({
    baseURL: `${baseURL}/prod-api`,
    headers,
    httpsAgent: ebHttpsAgent,
    timeout: 18000
  });
}

// ⚡ High-Capacity Multi-Worker Upstream Account Pool
// Distributes incoming WhatsApp pairing calls across 6 accounts round-robin
// Completely prevents 500 "Acesso muito frequente" and delivers instant pairing codes
const WORKER_POOL = [
  { username: '8801729261421', password: 'Khalid@86', token: null, cooldownUntil: 0 },
  { username: '8801602188682', password: 'Khalid@86', token: null, cooldownUntil: 0 },
  { username: '8801892736004', password: 'Khalid@86', token: null, cooldownUntil: 0 },
  { username: '8801773350030', password: 'Khalid@86', token: null, cooldownUntil: 0 },
  { username: '8801717424791', password: 'Khalid@86', token: null, cooldownUntil: 0 },
  { username: '8801713725515', password: 'Khalid@86', token: null, cooldownUntil: 0 }
];
let workerPoolIndex = 0;

async function loginWorkerAccount(worker, forceNew = false) {
  if (worker.token && !forceNew) return worker.token;
  try {
    const aesKeyStr = generateAesKey();
    const encryptedKeyHeader = encryptAesKeyWithRsa(aesKeyStr);
    const payloadObj = {
      tenantId: "000000",
      username: worker.username,
      password: worker.password,
      grantType: "password",
      clientId: CLIENT_ID,
      userType: "web_user"
    };
    const encryptedData = encryptPayloadAes(JSON.stringify(payloadObj), aesKeyStr);
    const headers = {
      'Content-Type': 'application/json;charset=utf-8',
      'clientid': CLIENT_ID,
      'encrypt-key': encryptedKeyHeader,
      'isToken': 'false',
      'repeatSubmit': 'false',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://earnbondhu.com/login',
      'Origin': 'https://earnbondhu.com'
    };
    const res = await axios.post('https://earnbondhu.com/prod-api/auth/login', encryptedData, { headers, timeout: 15000 });
    if (res.data && res.data.code === 200 && res.data.data?.access_token) {
      worker.token = res.data.data.access_token;
      console.log(`[Worker Pool] Refreshed token for ${worker.username}`);
      return worker.token;
    }
  } catch (err) {
    console.error(`[Worker Pool] Login failed for ${worker.username}:`, err.response?.data || err.message);
  }
  return null;
}

async function prewarmWorkerPool() {
  console.log('[Worker Pool] Pre-warming tokens for all accounts in pool...');
  for (const w of WORKER_POOL) {
    try {
      await loginWorkerAccount(w);
    } catch (e) {}
  }
  console.log('[Worker Pool] Pre-warming complete. All 6 workers ready!');
}

// -------------------------------------------------------------
// PERMANENT PHONE-TO-WORKER MAPPING SYSTEM
// -------------------------------------------------------------
function getAssignedWorkerForPhone(phoneNumber) {
  const cleanPhone = String(phoneNumber).replace(/^\+?880/, '').replace(/^0+/, '').trim();
  try {
    const mappings = db.get('phone_worker_mappings').value() || [];
    const found = mappings.find(m => m.phone_number === cleanPhone);
    if (found && found.worker_username) {
      const assigned = WORKER_POOL.find(w => w.username === found.worker_username);
      if (assigned) {
        console.log(`[Worker Pool] Recognized returning phone ${cleanPhone} -> assigned to ${assigned.username}`);
        return { worker: assigned, isMapped: true };
      }
    }
  } catch (e) {}
  return { worker: getNextAvailableWorker(), isMapped: false };
}

function recordPhoneWorkerMapping(phoneNumber, workerUsername) {
  const cleanPhone = String(phoneNumber).replace(/^\+?880/, '').replace(/^0+/, '').trim();
  if (!cleanPhone || !workerUsername) return;
  try {
    if (!db.get('phone_worker_mappings').value()) {
      db.set('phone_worker_mappings', []).write();
    }
    const mappings = db.get('phone_worker_mappings').value() || [];
    const existingIdx = mappings.findIndex(m => m.phone_number === cleanPhone);
    if (existingIdx >= 0) {
      mappings[existingIdx].worker_username = workerUsername;
      mappings[existingIdx].updated_at = Date.now();
    } else {
      mappings.push({
        phone_number: cleanPhone,
        worker_username: workerUsername,
        created_at: Date.now(),
        updated_at: Date.now()
      });
    }
    db.set('phone_worker_mappings', mappings).write();
    console.log(`[Worker Pool] Successfully mapped phone ${cleanPhone} to worker ${workerUsername}`);
  } catch (e) {
    console.error('[Worker Pool] Error saving phone worker mapping:', e.message);
  }
}

// -------------------------------------------------------------
// LIVE 6-WORKER ACCOUNTS BALANCE FETCHER (SUPER FAST CACHED)
// -------------------------------------------------------------
let cachedWorkerBalances = null;
let lastWorkerBalanceFetchTime = 0;
const WORKER_BALANCE_CACHE_TTL = 20000; // 20s cache for blazing speed

async function fetchWorkerPoolBalances(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedWorkerBalances && (now - lastWorkerBalanceFetchTime < WORKER_BALANCE_CACHE_TTL)) {
    return cachedWorkerBalances;
  }

  const results = [];
  let totalCombinedBalance = 0;
  let totalCombinedEarnings = 0;
  let totalCombinedWithdrawn = 0;

  for (let i = 0; i < WORKER_POOL.length; i++) {
    const w = WORKER_POOL[i];
    try {
      const token = await loginWorkerAccount(w);
      if (!token) {
        results.push({
          id: i + 1,
          username: w.username,
          balance: 0,
          points: 0,
          totalEarnings: 0,
          totalWithdrawn: 0,
          status: 'offline',
          inviteCode: 'N/A',
          isMaster: i === 0,
          error: 'Login failed'
        });
        continue;
      }

      const client = getEarnBondhuClient(token);
      const res = await client.get('/system/user/getInfo');
      const u = res.data?.data?.user;

      if (u) {
        // EarnBondhu official conversion: 100 Points = ৳ 1.00 (e.g. 3000 points = ৳ 30.00, 1300000 = ৳ 13,000.00)
        const bal = parseFloat(((parseFloat(u.points) || 0) / 100).toFixed(2));
        const total = parseFloat(((parseFloat(u.totalPoints) || 0) / 100).toFixed(2));
        const wth = parseFloat(((parseFloat(u.totalWithdrawal) || 0) / 100).toFixed(2));

        totalCombinedBalance += bal;
        totalCombinedEarnings += total;
        totalCombinedWithdrawn += wth;

        results.push({
          id: i + 1,
          username: w.username,
          balance: bal,
          points: parseInt(u.points || 0, 10),
          totalEarnings: total,
          totalWithdrawn: wth,
          status: u.status === '0' ? 'active' : 'inactive',
          inviteCode: u.inviteCode || '',
          isMaster: i === 0,
          updatedAt: Date.now()
        });
      } else {
        results.push({
          id: i + 1,
          username: w.username,
          balance: 0,
          points: 0,
          totalEarnings: 0,
          totalWithdrawn: 0,
          status: 'unknown',
          inviteCode: '',
          isMaster: i === 0
        });
      }
    } catch (err) {
      results.push({
        id: i + 1,
        username: w.username,
        balance: 0,
        points: 0,
        totalEarnings: 0,
        totalWithdrawn: 0,
        status: 'error',
        inviteCode: '',
        isMaster: i === 0,
        error: err.message
      });
    }
  }

  cachedWorkerBalances = {
    workers: results,
    totalCombinedBalance: parseFloat(totalCombinedBalance.toFixed(2)),
    totalCombinedEarnings: parseFloat(totalCombinedEarnings.toFixed(2)),
    totalCombinedWithdrawn: parseFloat(totalCombinedWithdrawn.toFixed(2)),
    cachedAt: Date.now()
  };
  lastWorkerBalanceFetchTime = Date.now();
  return cachedWorkerBalances;
}

function getNextAvailableWorker() {
  const now = Date.now();
  for (let i = 0; i < WORKER_POOL.length; i++) {
    const idx = (workerPoolIndex + i) % WORKER_POOL.length;
    const worker = WORKER_POOL[idx];
    if (worker.cooldownUntil <= now) {
      workerPoolIndex = (idx + 1) % WORKER_POOL.length;
      return worker;
    }
  }
  let earliest = WORKER_POOL[0];
  for (const w of WORKER_POOL) {
    if (w.cooldownUntil < earliest.cooldownUntil) earliest = w;
  }
  return earliest;
}

// 🛡️ Simultaneous request deduplication Map for concurrent pairing requests
const inFlightPairingRequests = new Map();

// 🚀 High-Reliability Upstream Dual-Worker Batch Queue for WhatsApp Pairing Codes
// Serializes calls cleanly to protect EarnBondhu sliding window rate limits.
const pairingQueue = [];
let isPairingQueueWorkerRunning = false;
let lastEarnBondhuCallTime = 0;
let queueCooldownUntil = 0;
const MIN_EARNBONDHU_GAP_MS = 1200;

async function processPairingQueueWorker() {
  if (isPairingQueueWorkerRunning) return;
  isPairingQueueWorkerRunning = true;
  while (pairingQueue.length > 0) {
    const job = pairingQueue.shift();
    
    // Check if upstream is in rate-limit cooldown
    const now = Date.now();
    if (queueCooldownUntil > now) {
      const waitCooldown = queueCooldownUntil - now;
      console.log(`[EarnBondhu Queue] Upstream rate-limit cooldown active. Waiting ${waitCooldown}ms before next call...`);
      await new Promise(r => setTimeout(r, waitCooldown));
    }

    const elapsed = Date.now() - lastEarnBondhuCallTime;
    if (elapsed < MIN_EARNBONDHU_GAP_MS && lastEarnBondhuCallTime > 0) {
      const waitTime = MIN_EARNBONDHU_GAP_MS - elapsed;
      console.log(`[EarnBondhu Queue] Spacing out upstream call: waiting ${waitTime}ms...`);
      await new Promise(r => setTimeout(r, waitTime));
    }

    try {
      const res = await job.fn();
      job.resolve(res);
    } catch (err) {
      // If rate limited, trigger global queue cooldown of 12 seconds so window resets cleanly
      const isRateLimit = err.response?.status === 500 && (
        err.response?.data?.msg?.includes('frequente') ||
        err.response?.data?.msg?.includes('tarde') ||
        err.message?.includes('frequente')
      );
      if (isRateLimit) {
        console.warn('[EarnBondhu Queue] Detected upstream frequency limit. Enforcing 16s queue cooldown for clean window reset.');
        queueCooldownUntil = Date.now() + 16000;
      }
      job.reject(err);
    } finally {
      lastEarnBondhuCallTime = Date.now();
    }
  }
  isPairingQueueWorkerRunning = false;
}

function enqueueEarnBondhuPairingCall(fn) {
  return new Promise((resolve, reject) => {
    pairingQueue.push({ fn, resolve, reject });
    processPairingQueueWorker();
  });
}

/**
 * Request Pairing Code from EarnBondhu (with automatic token retry & failover)
 */
async function fetchPairingCode(countryCode, phoneNumber, retryCount = 0) {
  const cleanPhone = String(phoneNumber).replace(/^\+?880/, '').replace(/^0+/, '').trim();

  // Instant response if active pairing code was generated recently (Memory or DB)
  const cached = activePairingCodeCache.get(cleanPhone);
  if (cached && (Date.now() - cached.timestamp < 180000)) {
    console.log(`[EarnBondhu Bridge] Returning cached active pairing code for ${cleanPhone}: ${cached.code}`);
    return {
      success: true,
      pairingCode: cached.code,
      cached: true
    };
  }
  try {
    const recentPending = (db.get('pending_pairings').value() || [])
      .filter(p => p.phone_number === cleanPhone && p.pairing_code && (Date.now() - (p.created_at || 0) < 180000))
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0];
    if (recentPending && recentPending.pairing_code) {
      activePairingCodeCache.set(cleanPhone, { code: recentPending.pairing_code, timestamp: recentPending.created_at || Date.now() });
      console.log(`[EarnBondhu Bridge] Returning DB-cached active pairing code for ${cleanPhone}: ${recentPending.pairing_code}`);
      return {
        success: true,
        pairingCode: recentPending.pairing_code,
        cached: true
      };
    }
  } catch (e) {}

  // Deduplicate in-flight concurrent requests for the same number
  if (inFlightPairingRequests.has(cleanPhone)) {
    console.log(`[EarnBondhu Bridge] Sharing in-flight pairing request promise for ${cleanPhone}`);
    return inFlightPairingRequests.get(cleanPhone);
  }

  const p = (async () => {
    try {
      return await _fetchPairingCodeInternal(countryCode, cleanPhone, retryCount);
    } finally {
      inFlightPairingRequests.delete(cleanPhone);
    }
  })();

  inFlightPairingRequests.set(cleanPhone, p);
  return p;
}

async function _fetchPairingCodeInternal(countryCode, cleanPhone, retryCount = 0) {
  const cached = activePairingCodeCache.get(cleanPhone);

  // Instant pre-check: if this phone number is already known to be online from cache, return immediately!
  try {
    const wsCheck = getCachedWsStatusList();
    const isActuallyOnline = (wsCheck || []).some(w => {
      const wClean = String(w.wsNumber).replace(/^\+?880/, '').replace(/^0+/, '').trim();
      return (wClean === cleanPhone || cleanPhone.endsWith(wClean) || wClean.endsWith(cleanPhone)) &&
             (w.currentStatus === '1' || String(w.currentStatus).toLowerCase() === 'online');
    });
    if (isActuallyOnline) {
      return {
        success: true,
        alreadyOnline: true,
        pairingCode: 'CONNECTED',
        msg: 'এই হোয়াটসঅ্যাপ নম্বরটি ইতোমধ্যে সফলভাবে সংযুক্ত (Online) আছে!'
      };
    }
  } catch (e) {}

  const { worker, isMapped } = getAssignedWorkerForPhone(cleanPhone);
  let token = worker.token;
  if (!token) {
    token = await loginWorkerAccount(worker);
  }

  try {
    const res = await enqueueEarnBondhuPairingCall(async () => {
      const client = getEarnBondhuClient(token);
      return await client.post('/bulk/account/getPairingCode', {
        countryCode: countryCode || '880',
        phoneNumber: cleanPhone
      });
    });

    const isSuccess = res.data && res.data.code === 200 && (res.data.data?.pairingCode || res.data.data?.code || (typeof res.data.data === 'string' && res.data.data.length >= 6));
    if (isSuccess) {
      const code = res.data.data?.pairingCode || res.data.data?.code || res.data.data;
      activePairingCodeCache.set(cleanPhone, { code, timestamp: Date.now() });
      recordPhoneWorkerMapping(cleanPhone, worker.username);
      console.log(`[Worker Pool] Successfully retrieved pairing code for ${cleanPhone} via ${worker.username}: ${code}`);
      return {
        success: true,
        pairingCode: code,
        raw: res.data
      };
    }

    const isUnauth = res.data?.code === 401 || (res.data?.msg && (res.data.msg.includes('falhou') || res.data.msg.includes('negado') || res.data.msg.includes('Autentica') || res.data.msg.includes('outro local') || res.data.msg.includes('sessão')));
    if (isUnauth && retryCount < 6) {
      console.warn(`[Worker Pool] Auth error on worker ${worker.username} (attempt ${retryCount + 1}). Refreshing worker token...`);
      worker.token = null;
      await loginWorkerAccount(worker, true);
      return _fetchPairingCodeInternal(countryCode, cleanPhone, retryCount + 1);
    }

    let errorMsg = res.data?.msg || 'পেয়ারিং কোড আনতে সমস্যা হয়েছে।';
    // 1. Instant detection: Already Linked / Active on WhatsApp
    if (errorMsg.includes('vinculado') || errorMsg.includes('troque')) {
      // If not mapped yet, auto-probe candidate workers to see if it belonged to one of our other workers!
      if (!isMapped && retryCount === 0) {
        for (const candidate of WORKER_POOL) {
          if (candidate.username === worker.username) continue;
          try {
            console.log(`[Worker Pool] Auto-probing candidate worker ${candidate.username} for returning phone ${cleanPhone}...`);
            const cToken = candidate.token || await loginWorkerAccount(candidate);
            if (!cToken) continue;
            const cClient = getEarnBondhuClient(cToken);
            const probeRes = await cClient.post('/bulk/account/getPairingCode', {
              countryCode: countryCode || '880',
              phoneNumber: cleanPhone
            });
            if (probeRes.data?.code === 200 && (probeRes.data?.data?.pairingCode || probeRes.data?.data?.code)) {
              const pCode = probeRes.data.data.pairingCode || probeRes.data.data.code;
              activePairingCodeCache.set(cleanPhone, { code: pCode, timestamp: Date.now() });
              recordPhoneWorkerMapping(cleanPhone, candidate.username);
              console.log(`[Worker Pool] Successfully recovered owner worker ${candidate.username} for ${cleanPhone}: ${pCode}`);
              return { success: true, pairingCode: pCode, raw: probeRes.data };
            }
          } catch (e) {}
        }
      }

      console.log(`[EarnBondhu Bridge] Number ${cleanPhone} is ALREADY LINKED on an external account!`);
      return {
        success: false,
        alreadyLinked: true,
        msg: 'এই হোয়াটসঅ্যাপ নম্বরটি ইতোমধ্যে সফলভাবে অন্য অ্যাকাউন্টে যুক্ত (Linked) রয়েছে! অনুগ্রহ করে নতুন কোনো নম্বর দিন।'
      };
    }

    if (errorMsg.includes('frequente') || errorMsg.includes('tarde')) {
      if (retryCount < 3) {
        worker.cooldownUntil = Date.now() + 20000;
        const anyReady = WORKER_POOL.some(w => (w.cooldownUntil || 0) <= Date.now());
        if (!anyReady) {
          let earliest = Math.min(...WORKER_POOL.map(w => w.cooldownUntil || 0));
          const waitMs = Math.min(5000, Math.max(1000, earliest - Date.now()));
          console.warn(`[Worker Pool] All workers cooling down. Waiting ${waitMs}ms before rotation...`);
          await new Promise(r => setTimeout(r, waitMs));
        } else {
          console.log(`[Worker Pool] Immediate rotate to next worker without pause.`);
          await new Promise(r => setTimeout(r, 300));
        }
        return _fetchPairingCodeInternal(countryCode, cleanPhone, retryCount + 1);
      }
      return {
        success: false,
        msg: 'সার্ভার সংযোগ সাময়িক ব্যস্ত রয়েছে। অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।'
      };
    } else if (errorMsg.includes('falhou') || errorMsg.includes('negado') || errorMsg.includes('Autentica') || res.data?.code === 401) {
      if (retryCount < 6) {
        worker.token = null;
        await loginWorkerAccount(worker, true);
        return _fetchPairingCodeInternal(countryCode, cleanPhone, retryCount + 1);
      }
      errorMsg = 'সার্ভার সংযোগ সাময়িক ব্যস্ত রয়েছে। অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।';
    }
    return {
      success: false,
      msg: errorMsg
    };
  } catch (err) {
    console.error(`[Proxy Bridge Error] fetchPairingCode via ${worker.username}:`, err.response?.data || err.message);
    const isUnauth = err.response?.status === 401 || err.response?.data?.code === 401 || (err.message && (err.message.includes('falhou') || err.message.includes('negado') || err.message.includes('outro local') || err.message.includes('sessão')));
    if (isUnauth && retryCount < 6) {
      console.warn(`[Worker Pool] Auth exception on worker ${worker.username} (attempt ${retryCount + 1}). Refreshing worker token...`);
      worker.token = null;
      await loginWorkerAccount(worker, true);
      return _fetchPairingCodeInternal(countryCode, cleanPhone, retryCount + 1);
    }
    let errMsg = err.response?.data?.msg || err.message;
    if (errMsg && (errMsg.includes('vinculado') || errMsg.includes('troque'))) {
      console.log(`[EarnBondhu Bridge] Number ${cleanPhone} is ALREADY LINKED on EarnBondhu (catch)!`);
      return {
        success: false,
        alreadyLinked: true,
        msg: 'এই হোয়াটসঅ্যাপ নম্বরটি ইতোমধ্যে সফলভাবে অন্য অ্যাকাউন্টে যুক্ত (Linked) রয়েছে! অনুগ্রহ করে নতুন কোনো নম্বর দিন।'
      };
    }
    if (errMsg && (errMsg.includes('frequente') || errMsg.includes('tarde') || errMsg.includes('timeout') || errMsg.includes('ECONNABORTED'))) {
      if (retryCount < 3) {
        const isFreq = errMsg.includes('frequente') || errMsg.includes('tarde');
        if (isFreq) {
          worker.cooldownUntil = Date.now() + 20000;
          const anyReady = WORKER_POOL.some(w => (w.cooldownUntil || 0) <= Date.now());
          if (!anyReady) {
            let earliest = Math.min(...WORKER_POOL.map(w => w.cooldownUntil || 0));
            const waitMs = Math.min(5000, Math.max(1000, earliest - Date.now()));
            console.warn(`[Worker Pool] All workers cooling down (catch). Waiting ${waitMs}ms...`);
            await new Promise(r => setTimeout(r, waitMs));
          } else {
            console.log(`[Worker Pool] Immediate rotate to next worker without pause (catch).`);
            await new Promise(r => setTimeout(r, 300));
          }
        }
        return _fetchPairingCodeInternal(countryCode, cleanPhone, retryCount + 1);
      }
      if (cached) {
        return {
          success: true,
          pairingCode: cached.code,
          msg: 'পেয়ারিং কোড প্রস্তুত!'
        };
      }
      errMsg = 'কোড প্রস্তুত হচ্ছে, অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করুন।';
    } else if (errMsg && (errMsg.includes('falhou') || errMsg.includes('negado') || errMsg.includes('Autentica'))) {
      if (retryCount < 4) {
        const newToken = await autoLoginEarnBondhu(true);
        if (newToken) {
          return _fetchPairingCodeInternal(countryCode, cleanPhone, retryCount + 1);
        }
      }
      errMsg = 'সার্ভার সংযোগ সাময়িক ব্যস্ত রয়েছে। অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।';
    }
    return {
      success: false,
      msg: errMsg || 'সার্ভার সংযোগ সাময়িক ব্যস্ত রয়েছে। অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।'
    };
  }
}

let cachedAccountList = null;
let lastAccountFetchTime = 0;
const CACHE_TTL_MS = 15000; // 15 seconds cache for blazing-fast dashboard load

/**
 * Fetch Account Status or Account List from EarnBondhu
 */
async function fetchAccountList(forceRefresh = false, isRetry = false) {
  const now = Date.now();
  // 🛡️ Give 100% priority to Pairing Code generation: never hit EarnBondhu if pairing is in flight
  if (inFlightPairingRequests.size > 0 || pairingQueue.length > 0) {
    if (cachedAccountList) return cachedAccountList;
  }
  // Throttle forceRefresh to at least 8000ms
  if (cachedAccountList && (now - lastAccountFetchTime < (forceRefresh ? 8000 : CACHE_TTL_MS))) {
    return cachedAccountList;
  }

  let token = getConfig('master_target_token');
  if (!token) {
    token = await autoLoginEarnBondhu();
  }

  const client = getEarnBondhuClient();

  try {
    const res = await client.get('/bulk/account/list?pageNum=1&pageSize=100');
    const isUnauth = res.data?.code === 401 || (res.data?.msg && (res.data.msg.includes('falhou') || res.data.msg.includes('negado')));
    if (res.data && res.data.code === 200 && !isUnauth) {
      cachedAccountList = res.data;
      lastAccountFetchTime = now;
      return res.data;
    } else if (isUnauth && !isRetry) {
      if (isLoginCooldownActive()) {
        console.log('[EarnBondhu Bridge] Admin active on phone. Skipping auto-login to preserve phone session.');
        return cachedAccountList || { rows: [] };
      }
      recordUnauthDetected();
      console.warn('[EarnBondhu Bridge] 401 in fetchAccountList. Pausing auto-login for 60s.');
      return cachedAccountList || { rows: [] };
    }
    return cachedAccountList || { rows: [] };
  } catch (err) {
    console.error('[Proxy Bridge Error] fetchAccountList:', err.response?.data || err.message);
    if ((err.response?.status === 401 || err.response?.data?.code === 401) && !isRetry) {
      if (isLoginCooldownActive()) {
        return cachedAccountList || { rows: [] };
      }
      recordUnauthDetected();
      console.warn('[EarnBondhu Bridge] 401 exception in fetchAccountList. Pausing auto-login for 60s.');
      return cachedAccountList || { rows: [] };
    }
    return cachedAccountList || { rows: [] };
  }
}

let cachedWsStatusList = null;
let lastWsStatusFetchTime = 0;
const WS_CACHE_TTL_MS = 12000; // 12 seconds cache to prevent rate-limit contention

/**
 * Fetch Real-time WS Online Status & Settlement Countdown data directly from EarnBondhu
 */
async function fetchWsOnlineStatusList(forceRefresh = false, isRetry = false) {
  const now = Date.now();
  // 🛡️ Give 100% priority to Pairing Code generation: never hit EarnBondhu if pairing is in flight
  if (inFlightPairingRequests.size > 0 || pairingQueue.length > 0) {
    if (cachedWsStatusList) return cachedWsStatusList;
  }
  // Throttle forceRefresh to at least 8000ms
  if (cachedWsStatusList && (now - lastWsStatusFetchTime < (forceRefresh ? 8000 : WS_CACHE_TTL_MS))) {
    return cachedWsStatusList;
  }

  let token = getConfig('master_target_token');
  if (!token) {
    token = await autoLoginEarnBondhu();
  }

  const client = getEarnBondhuClient();

  try {
    const res = await client.get('/system/wsOnlineStatus/list');
    const isUnauth = res.data?.code === 401 || (res.data?.msg && (res.data.msg.includes('falhou') || res.data.msg.includes('negado')));
    if (res.data && res.data.code === 200 && !isUnauth) {
      cachedWsStatusList = res.data.data || [];
      lastWsStatusFetchTime = now;
      return cachedWsStatusList;
    } else if (isUnauth && !isRetry) {
      if (isLoginCooldownActive()) {
        console.log('[EarnBondhu Bridge] Admin active on phone. Skipping auto-login to preserve phone session.');
        return cachedWsStatusList || [];
      }
      recordUnauthDetected();
      console.warn('[EarnBondhu Bridge] 401 in fetchWsOnlineStatusList. Pausing auto-login for 60s.');
      return cachedWsStatusList || [];
    }
    return cachedWsStatusList || [];
  } catch (err) {
    console.error('[Proxy Bridge Error] fetchWsOnlineStatusList:', err.response?.data || err.message);
    if ((err.response?.status === 401 || err.response?.data?.code === 401) && !isRetry) {
      if (isLoginCooldownActive()) {
        return cachedWsStatusList || [];
      }
      recordUnauthDetected();
      console.warn('[EarnBondhu Bridge] 401 exception in fetchWsOnlineStatusList. Pausing auto-login for 60s.');
      return cachedWsStatusList || [];
    }
    return cachedWsStatusList || [];
  }
}

async function fetchAccountStatus(phoneNumber) {
  const cleanPhone = String(phoneNumber).replace(/^[0+]/, '').trim();
  const listData = await fetchAccountList();
  const accounts = listData.rows || [];
  
  const found = accounts.find(a => 
    String(a.phoneNumber).trim() === cleanPhone || 
    String(a.pn).includes(cleanPhone)
  );

  return found || null;
}

async function fetchOfficialSettlementsList(isRetry = false) {
  let token = getConfig('master_target_token');
  if (!token) {
    token = await autoLoginEarnBondhu();
  }
  const client = getEarnBondhuClient();
  const currentUsername = getConfig('master_username') || MASTER_USERNAME;
  try {
    const res = await client.get('/system/pointsSettle/list', {
      params: { pageNum: 1, pageSize: 100, userName: currentUsername }
    });
    if (res.data && res.data.code === 200 && Array.isArray(res.data.rows)) {
      return res.data.rows;
    } else if (res.data?.code === 401 && !isRetry) {
      if (isLoginCooldownActive()) return [];
      recordUnauthDetected();
      return [];
    }
    return [];
  } catch (err) {
    if (err.response?.status === 401 && !isRetry) {
      if (isLoginCooldownActive()) return [];
      recordUnauthDetected();
      return [];
    }
    return [];
  }
}


function getActivePairingCode(phoneNumber) {
  const cleanPhone = String(phoneNumber).replace(/^\+?880/, '').replace(/^0+/, '').trim();
  const cached = activePairingCodeCache.get(cleanPhone);
  if (cached && (Date.now() - cached.timestamp < 300000)) {
    return cached.code;
  }
  return null;
}

function isPairingInFlight(phoneNumber) {
  const cleanPhone = String(phoneNumber).replace(/^\+?880/, '').replace(/^0+/, '').trim();
  return inFlightPairingRequests.has(cleanPhone);
}

module.exports = {
  WORKER_POOL,
  loginWorkerAccount,
  getNextAvailableWorker,
  getAssignedWorkerForPhone,
  recordPhoneWorkerMapping,
  fetchWorkerPoolBalances,
  prewarmWorkerPool,
  getActivePairingCode,
  isPairingInFlight,
  getConfig,
  setConfig,
  fetchPairingCode,
  fetchAccountStatus,
  fetchAccountList,
  fetchWsOnlineStatusList,
  getCachedWsStatusList: () => cachedWsStatusList || [],
  fetchOfficialSettlementsList,
  autoLoginEarnBondhu,
  getEarnBondhuClient
};
