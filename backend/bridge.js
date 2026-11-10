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

function getEarnBondhuClient() {
  const baseURL = getConfig('target_base_url') || 'https://earnbondhu.com';
  const clientId = getConfig('target_client_id') || CLIENT_ID;
  const masterToken = getConfig('master_target_token') || '';

  const headers = {
    'Content-Type': 'application/json;charset=utf-8',
    'clientid': clientId,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://earnbondhu.com/',
    'Origin': 'https://earnbondhu.com'
  };

  if (masterToken) {
    headers['Authorization'] = 'Bearer ' + masterToken;
  }

  return axios.create({
    baseURL: `${baseURL}/prod-api`,
    headers,
    httpsAgent: ebHttpsAgent,
    timeout: 18000
  });
}

// 🛡️ Simultaneous request deduplication Map for concurrent pairing requests
const inFlightPairingRequests = new Map();

// 🚀 High-Reliability Upstream FIFO Queue for WhatsApp Pairing Codes
// EarnBondhu imposes a strict rate-limit per master account. This queue serializes
// concurrent requests and automatically spaces them out by 6.0 seconds so no user fails!
let pairingQueuePromise = Promise.resolve();
let lastEarnBondhuCallTime = 0;
const MIN_EARNBONDHU_GAP_MS = 6000;

function enqueueEarnBondhuPairingCall(fn) {
  const current = pairingQueuePromise.then(async () => {
    const now = Date.now();
    const elapsed = now - lastEarnBondhuCallTime;
    if (elapsed < MIN_EARNBONDHU_GAP_MS && lastEarnBondhuCallTime > 0) {
      const waitTime = MIN_EARNBONDHU_GAP_MS - elapsed;
      console.log(`[EarnBondhu Queue] Spacing out upstream pairing requests: waiting ${waitTime}ms...`);
      await new Promise(r => setTimeout(r, waitTime));
    }
    try {
      return await fn();
    } finally {
      lastEarnBondhuCallTime = Date.now();
    }
  });
  pairingQueuePromise = current.catch(() => {});
  return current;
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

  let token = getConfig('master_target_token');
  if (!token) {
    token = await autoLoginEarnBondhu();
  }

  try {
    const res = await enqueueEarnBondhuPairingCall(async () => {
      const client = getEarnBondhuClient();
      return await client.post('/bulk/account/getPairingCode', {
        countryCode: countryCode || '880',
        phoneNumber: cleanPhone
      });
    });

    const isSuccess = res.data && res.data.code === 200 && (res.data.data?.pairingCode || res.data.data?.code || (typeof res.data.data === 'string' && res.data.data.length >= 6));
    if (isSuccess) {
      const code = res.data.data?.pairingCode || res.data.data?.code || res.data.data;
      activePairingCodeCache.set(cleanPhone, { code, timestamp: Date.now() });
      return {
        success: true,
        pairingCode: code,
        raw: res.data
      };
    }

    const isUnauth = res.data?.code === 401 || (res.data?.msg && (res.data.msg.includes('falhou') || res.data.msg.includes('negado') || res.data.msg.includes('Autentica') || res.data.msg.includes('outro local') || res.data.msg.includes('sessão')));
    if (isUnauth && retryCount < 2) {
      console.warn(`[EarnBondhu Bridge] Auth error in getPairingCode (attempt ${retryCount + 1}). Re-authenticating master account...`);
      const newToken = await autoLoginEarnBondhu(true);
      if (newToken) {
        return _fetchPairingCodeInternal(countryCode, cleanPhone, retryCount + 1);
      }
    }

    let errorMsg = res.data?.msg || 'পেয়ারিং কোড আনতে সমস্যা হয়েছে।';
    if (errorMsg.includes('vinculado') || errorMsg.includes('troque') || errorMsg.includes('frequente') || errorMsg.includes('tarde')) {
      if (retryCount < 3) {
        console.warn(`[EarnBondhu Bridge] Rate limit or frequency delay for ${cleanPhone} (attempt ${retryCount + 1}). Retrying via queue in 6.5s...`);
        await new Promise(r => setTimeout(r, 6500));
        return _fetchPairingCodeInternal(countryCode, cleanPhone, retryCount + 1);
      }

      // Check if actually online
      const wsCheck = await fetchWsOnlineStatusList(true).catch(() => []);
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
      if (cached) {
        return {
          success: true,
          pairingCode: cached.code,
          msg: 'পেয়ারিং কোড প্রস্তুত!'
        };
      }
      errorMsg = 'কোড প্রস্তুত হচ্ছে, অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করুন।';
    } else if (errorMsg.includes('falhou') || errorMsg.includes('negado') || errorMsg.includes('Autentica') || res.data?.code === 401) {
      if (retryCount < 2) {
        const newToken = await autoLoginEarnBondhu(true);
        if (newToken) {
          return _fetchPairingCodeInternal(countryCode, cleanPhone, retryCount + 1);
        }
      }
      errorMsg = 'সার্ভার সংযোগ সাময়িক ব্যস্ত রয়েছে। অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।';
    }
    return {
      success: false,
      msg: errorMsg
    };
  } catch (err) {
    console.error('[Proxy Bridge Error] fetchPairingCode:', err.response?.data || err.message);
    const isUnauth = err.response?.status === 401 || err.response?.data?.code === 401 || (err.message && (err.message.includes('falhou') || err.message.includes('negado')));
    if (isUnauth && retryCount < 2) {
      console.warn(`[EarnBondhu Bridge] Auth exception in getPairingCode (attempt ${retryCount + 1}). Re-authenticating master account...`);
      const newToken = await autoLoginEarnBondhu(true);
      if (newToken) {
        return _fetchPairingCodeInternal(countryCode, cleanPhone, retryCount + 1);
      }
    }
    let errMsg = err.response?.data?.msg || err.message;
    if (errMsg && (errMsg.includes('vinculado') || errMsg.includes('troque') || errMsg.includes('frequente') || errMsg.includes('tarde') || errMsg.includes('timeout') || errMsg.includes('ECONNABORTED'))) {
      if (retryCount < 3) {
        console.warn(`[EarnBondhu Bridge] Catch error retry for ${cleanPhone} (attempt ${retryCount + 1}). Retrying via queue in 6.5s...`);
        await new Promise(r => setTimeout(r, 6500));
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
      if (retryCount < 2) {
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
}

let cachedAccountList = null;
let lastAccountFetchTime = 0;
const CACHE_TTL_MS = 15000; // 15 seconds cache for blazing-fast dashboard load

/**
 * Fetch Account Status or Account List from EarnBondhu
 */
async function fetchAccountList(forceRefresh = false, isRetry = false) {
  const now = Date.now();
  if (!forceRefresh && cachedAccountList && (now - lastAccountFetchTime < CACHE_TTL_MS)) {
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
const WS_CACHE_TTL_MS = 2500;

/**
 * Fetch Real-time WS Online Status & Settlement Countdown data directly from EarnBondhu
 */
async function fetchWsOnlineStatusList(forceRefresh = false, isRetry = false) {
  const now = Date.now();
  if (!forceRefresh && cachedWsStatusList && (now - lastWsStatusFetchTime < WS_CACHE_TTL_MS)) {
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
