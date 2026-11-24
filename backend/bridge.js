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
const ADMIN_LOGIN_COOLDOWN_MS = 50 * 1000; // 50 seconds cooldown so admin can use phone without session conflict

function recordUnauthDetected() {
  lastUnauthDetectedTime = Date.now();
  console.log('⚠️ [EarnBondhu Bridge] 401 detected. Entering 50s cooldown to allow Admin phone withdrawal.');
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

// ⚡ High-Capacity Multi-Worker Upstream Account Pool (Disconnected/Removed)
const WORKER_POOL = [];
let workerPoolIndex = 0;

async function loginWorkerAccount(worker, forceNew = false) {
  return null;
}

async function prewarmWorkerPool() {
  return;
}

// -------------------------------------------------------------
// PERMANENT PHONE-TO-WORKER MAPPING SYSTEM (WITH DYNAMIC ROTATION)
// -------------------------------------------------------------
function getAssignedWorkerForPhone(phoneNumber, excludedUsernames = []) {
  const cleanPhone = String(phoneNumber).replace(/^\+?880/, '').replace(/^0+/, '').trim();
  const excluded = Array.isArray(excludedUsernames) ? excludedUsernames : (excludedUsernames ? [excludedUsernames] : []);
  const now = Date.now();
  try {
    const mappings = db.get('phone_worker_mappings').value() || [];
    const found = mappings.find(m => m.phone_number === cleanPhone);
    if (found && found.worker_username && !excluded.includes(found.worker_username)) {
      const assigned = WORKER_POOL.find(w => w.username === found.worker_username);
      if (assigned && (!assigned.cooldownUntil || assigned.cooldownUntil <= now)) {
        console.log(`[Worker Pool] Recognized returning phone ${cleanPhone} -> assigned to ${assigned.username}`);
        return { worker: assigned, isMapped: true };
      }
    }
    const linked = (db.get('linked_numbers').value() || []).find(n => {
      const nClean = String(n.phone_number).replace(/^\+?880/, '').replace(/^0+/, '').trim();
      return nClean === cleanPhone;
    });
    if (linked && linked.worker_username && !excluded.includes(linked.worker_username)) {
      const assigned = WORKER_POOL.find(w => w.username === linked.worker_username);
      if (assigned && (!assigned.cooldownUntil || assigned.cooldownUntil <= now)) {
        console.log(`[Worker Pool] Recognized returning phone ${cleanPhone} from linked_numbers -> assigned to ${assigned.username}`);
        return { worker: assigned, isMapped: true };
      }
    }
  } catch (e) {}
  return { worker: getNextAvailableWorker(excluded), isMapped: false };
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

    // Also update linked_numbers so ownership is permanently mapped in MongoDB Atlas
    try {
      const linkedList = db.get('linked_numbers').value() || [];
      const matchedLinked = linkedList.find(n => {
        const nClean = String(n.phone_number).replace(/^\+?880/, '').replace(/^0+/, '').trim();
        return nClean === cleanPhone;
      });
      if (matchedLinked) {
        db.get('linked_numbers').find({ id: matchedLinked.id }).assign({ worker_username: workerUsername }).write();
      }
    } catch (err) {}

    if (db.syncToCloud) {
      setImmediate(() => { db.syncToCloud(false).catch(() => {}); });
    }
    console.log(`[Worker Pool] Successfully mapped phone ${cleanPhone} to worker ${workerUsername}`);
  } catch (e) {
    console.error('[Worker Pool] Error saving phone worker mapping:', e.message);
  }
}

// -------------------------------------------------------------
// LIVE 6-WORKER ACCOUNTS BALANCE FETCHER (DISCONNECTED/REMOVED)
// -------------------------------------------------------------
async function fetchWorkerPoolBalances(forceRefresh = false) {
  return {
    workers: [],
    totalCombinedBalance: 0,
    totalCombinedEarnings: 0,
    totalCombinedWithdrawn: 0,
    totalCombinedOnlineWa: 0,
    cachedAt: Date.now()
  };
}

function getNextAvailableWorker(excludedUsernames = []) {
  const now = Date.now();
  const excluded = Array.isArray(excludedUsernames) ? excludedUsernames : (excludedUsernames ? [excludedUsernames] : []);
  
  // 1. Filter out excluded workers and workers in active admin cooldown
  const available = WORKER_POOL.filter(w => !excluded.includes(w.username) && (!w.cooldownUntil || w.cooldownUntil <= now));
  const pool = available.length > 0 ? available : WORKER_POOL.filter(w => !excluded.includes(w.username));
  const usable = pool.length > 0 ? pool : WORKER_POOL;

  // 2. Select the worker that has been IDLE THE LONGEST (oldest lastCallTime)
  // This automatically distributes calls across all 6 workers and completely prevents rate limits!
  let best = usable[0];
  for (const w of usable) {
    if ((w.lastCallTime || 0) < (best.lastCallTime || 0)) {
      best = w;
    }
  }
  return best;
}

// 🛡️ Simultaneous request deduplication Map for concurrent pairing requests
const inFlightPairingRequests = new Map();

// 🚀 Ultra-Fast Non-Blocking Per-Worker Dispatch System
// Replaces global queue bottleneck: Each of the 6 accounts runs independently in parallel.
// If one account faces a rate limit, ONLY that account is cooled down — others continue at blazing sub-second speed!
async function executeWorkerPairingCall(worker, fn) {
  const now = Date.now();
  const lastCall = worker.lastCallTime || 0;
  const elapsed = now - lastCall;
  // EarnBondhu per-worker debounce: minimum 1500ms between calls to the SAME worker
  if (elapsed < 1500 && lastCall > 0) {
    await new Promise(r => setTimeout(r, 1500 - elapsed));
  }
  worker.lastCallTime = Date.now();
  try {
    return await fn();
  } catch (err) {
    const isRateLimit = (err.response?.status === 500 || err.status === 500) && (
      err.response?.data?.msg?.includes('frequente') ||
      err.response?.data?.msg?.includes('tarde') ||
      err.message?.includes('frequente')
    );
    if (isRateLimit) {
      worker.lastCallTime = Date.now() + 10000;
      worker.cooldownUntil = Date.now() + 15000;
      console.warn(`[Worker Pool] Upstream frequency limit on ${worker.username}. 15s cooldown isolated to this worker only.`);
    }
    throw err;
  }
}

function enqueueEarnBondhuPairingCall(fn) {
  return fn();
}

/**
 * Request Pairing Code from EarnBondhu (Disabled - Service Closed)
 */
async function fetchPairingCode(countryCode, phoneNumber, retryCount = 0) {
  return {
    success: false,
    msg: 'হোয়াটসঅ্যাপ আর্নিং সেবা বর্তমানে বন্ধ রয়েছে।'
  };
}

async function fetchAccountList(forceRefresh = false, isRetry = false) {
  return { code: 200, rows: [], total: 0 };
}

async function fetchWsOnlineStatusList(forceRefresh = false, isRetry = false) {
  return [];
}

/**
 * Fetch Account Status for a specific phone number across mapped worker and pool in under 60ms
 */
async function fetchAccountStatus(phoneNumber) {
  return null;
}

async function fetchOfficialSettlementsList(isRetry = false) {
  return [];
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
