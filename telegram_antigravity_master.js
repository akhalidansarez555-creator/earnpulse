const fs = require('fs');
const path = require('path');
const { execFile, execFileSync } = require('child_process');

// Keep process completely indestructible
process.on('uncaughtException', (err) => {
  log('[UncaughtException] ' + (err ? err.stack || err.message : 'Unknown'));
});
process.on('unhandledRejection', (reason) => {
  log('[UnhandledRejection] ' + String(reason));
});

const BOT_TOKEN = '8351110635:AAHfx4wDVEt_UpxFfb5H4FLl0hKjCEmSrmI';
const CONVERSATION_ID = '291ed710-af3c-4dd8-a885-03f6b0ce406e';
const AGENT_EXE = 'C:\\Users\\Khalid Mama\\AppData\\Local\\Programs\\antigravity\\resources\\bin\\language_server.exe';
const TRANSCRIPT_PATH = path.join('C:\\Users\\Khalid Mama\\.gemini\\antigravity\\brain', CONVERSATION_ID, '.system_generated', 'logs', 'transcript.jsonl');
const LOG_FILE = path.join(__dirname, 'master_bridge.log');

function log(msg) {
  try {
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {}
}

const ADMIN_CHAT_ID = 5314046368;
const PINNED_MSG_ID = 377;

log('🚀 Single Unified Antigravity Master Bridge Started (100% Hidden)');

// -------------------------------------------------------------
// 1. LIVE ANTIGRAVITY ENGINE & PORT DETECTOR
// -------------------------------------------------------------
const DAEMON_DIR = 'C:\\Users\\Khalid Mama\\.gemini\\antigravity\\daemon';

function cleanupDeadHubFiles() {
  try {
    if (!fs.existsSync(DAEMON_DIR)) return;
    const files = fs.readdirSync(DAEMON_DIR).filter(f => f.startsWith('hub_') && f.endsWith('.json'));
    for (const f of files) {
      const fullPath = path.join(DAEMON_DIR, f);
      try {
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (data.pid) {
          try {
            process.kill(data.pid, 0);
          } catch (e) {
            fs.unlinkSync(fullPath);
            log(`Cleaned up stale daemon file: ${f} (PID ${data.pid})`);
          }
        }
      } catch (e) {}
    }
  } catch (e) {}
}

function getActiveHubData() {
  try {
    cleanupDeadHubFiles();
    if (!fs.existsSync(DAEMON_DIR)) return null;
    const files = fs.readdirSync(DAEMON_DIR).filter(f => f.startsWith('hub_') && f.endsWith('.json'));
    if (files.length === 0) return null;
    files.sort((a, b) => fs.statSync(path.join(DAEMON_DIR, b)).mtimeMs - fs.statSync(path.join(DAEMON_DIR, a)).mtimeMs);
    const latestHub = path.join(DAEMON_DIR, files[0]);
    return JSON.parse(fs.readFileSync(latestHub, 'utf8'));
  } catch (e) {
    return null;
  }
}

async function isAntigravityReady() {
  try {
    const hubData = getActiveHubData();
    if (!hubData || !hubData.httpPort) return false;

    if (hubData.pid) {
      try {
        process.kill(hubData.pid, 0);
      } catch (e) {
        return false;
      }
    }

    const res = await fetch(`http://127.0.0.1:${hubData.httpPort}/`, {
      signal: AbortSignal.timeout(3000)
    });
    return res.status === 200;
  } catch (e) {
    return false;
  }
}

// -------------------------------------------------------------
// 2. TELEGRAM API HELPERS
// -------------------------------------------------------------
async function sendTelegram(chatId, text) {
  if (!chatId || !text) return null;
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const maxLen = 4000;
  let lastResult = null;
  for (let i = 0; i < text.length; i += maxLen) {
    const chunk = text.substring(i, i + maxLen);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          disable_web_page_preview: true
        }),
        signal: AbortSignal.timeout(6000)
      });
      lastResult = await res.json();
    } catch (e) {
      log('sendTelegram error: ' + e.message);
    }
  }
  return lastResult;
}

async function editTelegram(chatId, messageId, text) {
  if (!chatId || !messageId || !text) return;
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: text.substring(0, 4000),
        disable_web_page_preview: true
      }),
      signal: AbortSignal.timeout(5000)
    });
  } catch (e) {
    // Ignore "message is not modified"
  }
}

async function sendChatAction(chatId, action = 'typing') {
  if (!chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
      signal: AbortSignal.timeout(4000)
    });
  } catch (e) {}
}

const tempDownloadedPhotos = new Set();

function cleanTempPhotos() {
  for (const p of tempDownloadedPhotos) {
    try {
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
        log(`Auto-deleted temporary photo: ${p}`);
      }
    } catch (e) {}
  }
  tempDownloadedPhotos.clear();

  // Periodic safety sweep: remove any telegram_* image older than 3 minutes
  try {
    const brainUploadsDir = path.join('C:\\Users\\Khalid Mama\\.gemini\\antigravity\\brain', CONVERSATION_ID, '.user_uploaded');
    if (fs.existsSync(brainUploadsDir)) {
      const files = fs.readdirSync(brainUploadsDir).filter(f => f.startsWith('telegram_'));
      const now = Date.now();
      for (const f of files) {
        const full = path.join(brainUploadsDir, f);
        try {
          if (now - fs.statSync(full).mtimeMs > 3 * 60 * 1000) {
            fs.unlinkSync(full);
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
}

async function downloadTelegramFile(fileId) {
  try {
    const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`, {
      signal: AbortSignal.timeout(10000)
    });
    const fileJson = await fileRes.json();
    if (!fileJson.ok || !fileJson.result?.file_path) return null;

    const remotePath = fileJson.result.file_path;
    const ext = path.extname(remotePath) || '.jpg';
    const fileName = `telegram_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${ext}`;

    const brainUploadsDir = path.join('C:\\Users\\Khalid Mama\\.gemini\\antigravity\\brain', CONVERSATION_ID, '.user_uploaded');
    if (!fs.existsSync(brainUploadsDir)) {
      fs.mkdirSync(brainUploadsDir, { recursive: true });
    }
    const targetFile = path.join(brainUploadsDir, fileName);

    const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${remotePath}`;
    const dlRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(25000) });
    const buffer = Buffer.from(await dlRes.arrayBuffer());
    fs.writeFileSync(targetFile, buffer);

    tempDownloadedPhotos.add(targetFile);

    // Auto-delete timer: guarantees file is removed after 2 minutes even if task doesn't explicitly finish
    setTimeout(() => {
      try {
        if (fs.existsSync(targetFile)) {
          fs.unlinkSync(targetFile);
          tempDownloadedPhotos.delete(targetFile);
          log(`Auto-deleted temporary photo after timeout: ${targetFile}`);
        }
      } catch (e) {}
    }, 120000);

    log(`Temporarily saved Telegram photo: ${targetFile} (${buffer.length} bytes)`);
    return targetFile;
  } catch (err) {
    log('downloadTelegramFile error: ' + err.message);
    return null;
  }
}

// -------------------------------------------------------------
// 3. PRESENCE TRACKER (PINNED BANNER & CLOUD HEARTBEAT)
// -------------------------------------------------------------
let currentPresence = null; // true = online, false = offline
let lastHeartbeatTime = 0;
let consecutiveFailures = 0;

async function updatePresence(isOnline, updateTelegram = true) {
  if (updateTelegram) {
    // Edit Pinned Message at top of chat only
    const pinText = isOnline
      ? '🟢 [লাইভ স্ট্যাটাস]: Antigravity পিসিতে অনলাইন ও প্রস্তুত রয়েছে! ✅'
      : '🔴 [লাইভ স্ট্যাটাস]: Antigravity এখন অফলাইন! (পিসিতে সফটওয়্যার বন্ধ রয়েছে) ❌';
    await editTelegram(ADMIN_CHAT_ID, PINNED_MSG_ID, pinText);
    log(`Telegram presence UI updated to -> ${isOnline ? 'ONLINE 🟢' : 'OFFLINE 🔴'}`);
  }

  // 3. Heartbeat to Cloud (always sync with cloud on interval)
  try {
    const s = isOnline ? 'online' : 'offline';
    await fetch(`https://earnpulse-beta.vercel.app/api/bridge-heartbeat?status=${s}`, {
      signal: AbortSignal.timeout(5000)
    });
  } catch (e) {}
}

async function monitorPresence() {
  const isReady = await isAntigravityReady();
  const now = Date.now();

  let determinedOnline;
  if (isReady) {
    consecutiveFailures = 0;
    determinedOnline = true;
  } else {
    consecutiveFailures++;
    if (consecutiveFailures >= 4) {
      determinedOnline = false;
    } else {
      determinedOnline = currentPresence !== null ? currentPresence : false;
    }
  }

  const statusChanged = (currentPresence === null || determinedOnline !== currentPresence);

  if (statusChanged) {
    currentPresence = determinedOnline;
    lastHeartbeatTime = now;
    await updatePresence(determinedOnline, true);
  } else if (now - lastHeartbeatTime > 30000) {
    lastHeartbeatTime = now;
    await updatePresence(determinedOnline, false);
  }
}

setInterval(() => {
  monitorPresence().catch(err => log('monitorPresence error: ' + err.message));
}, 2500);

monitorPresence();

// -------------------------------------------------------------
// 4. LIVE STEP-BY-STEP PROGRESS STREAMER
// -------------------------------------------------------------
let isWorking = false;
let currentProgressMsgId = null;
let liveSteps = [];
let typingInterval = null;
let lastEditTime = 0;

function startWorking(chatId, initialMsgId) {
  isWorking = true;
  currentProgressMsgId = initialMsgId;
  liveSteps = [];
  sendChatAction(chatId, 'typing');
  if (typingInterval) clearInterval(typingInterval);
  typingInterval = setInterval(() => {
    if (isWorking) {
      sendChatAction(chatId, 'typing');
    } else {
      clearInterval(typingInterval);
      typingInterval = null;
    }
  }, 4000);
}

function stopWorking() {
  isWorking = false;
  if (typingInterval) {
    clearInterval(typingInterval);
    typingInterval = null;
  }
  currentProgressMsgId = null;
  liveSteps = [];
  cleanTempPhotos();
}

async function updateLiveProgress(newStepSummary) {
  if (!isWorking || !currentProgressMsgId) return;
  if (newStepSummary) {
    const cleanSummary = String(newStepSummary).trim();
    if (liveSteps.length === 0 || liveSteps[liveSteps.length - 1] !== cleanSummary) {
      liveSteps.push(cleanSummary);
      if (liveSteps.length > 8) liveSteps.shift();
    }
  }

  const now = Date.now();
  if (now - lastEditTime < 1500) return;
  lastEditTime = now;

  const displayList = liveSteps.map((s, idx) => {
    const isLast = idx === liveSteps.length - 1;
    return isLast ? `⏳ ${s}...` : `✅ ${s}`;
  }).join('\n');

  const text = `⚡ Antigravity লাইভ প্রগ্রেস:\n\n${displayList}\n\n(পিসিতে কাজ চলমান রয়েছে...)`;
  await editTelegram(ADMIN_CHAT_ID, currentProgressMsgId, text);
}

// -------------------------------------------------------------
// 5. TRANSCRIPT TAILER FOR LIVE TOOLS & FINAL CONTENT
// -------------------------------------------------------------
let lastFileOffset = 0;
let lastStepSent = -1;
let lineBuffer = '';

if (fs.existsSync(TRANSCRIPT_PATH)) {
  try {
    const stat = fs.statSync(TRANSCRIPT_PATH);
    lastFileOffset = stat.size;
    const fd = fs.openSync(TRANSCRIPT_PATH, 'r');
    const readLen = Math.min(stat.size, 32768);
    const buf = Buffer.alloc(readLen);
    fs.readSync(fd, buf, 0, readLen, stat.size - readLen);
    fs.closeSync(fd);
    const lines = buf.toString('utf8').split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.step_index && entry.step_index > lastStepSent) {
          lastStepSent = entry.step_index;
        }
      } catch (e) {}
    }
  } catch (e) {}
}
log(`Initial lastStepSent: ${lastStepSent} | Offset: ${lastFileOffset}`);

function pollTranscript() {
  if (!fs.existsSync(TRANSCRIPT_PATH)) return;
  try {
    const stat = fs.statSync(TRANSCRIPT_PATH);
    if (stat.size <= lastFileOffset) return;

    const bytesToRead = stat.size - lastFileOffset;
    const buf = Buffer.alloc(bytesToRead);
    const fd = fs.openSync(TRANSCRIPT_PATH, 'r');
    fs.readSync(fd, buf, 0, bytesToRead, lastFileOffset);
    fs.closeSync(fd);
    lastFileOffset = stat.size;

    lineBuffer += buf.toString('utf8');
    const rawLines = lineBuffer.split('\n');
    lineBuffer = rawLines.pop();

    for (const line of rawLines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line.trim());

        // 1. Tool Call Progress
        if (entry.type === 'PLANNER_RESPONSE' && Array.isArray(entry.tool_calls) && entry.tool_calls.length > 0) {
          for (const tc of entry.tool_calls) {
            let summary = '';
            const args = tc.args || {};
            if (args.toolSummary) {
              summary = String(args.toolSummary).replace(/^"|"$/g, '').trim();
            } else if (tc.name === 'run_command' && args.CommandLine) {
              const cmdPreview = String(args.CommandLine).substring(0, 35).replace(/\r?\n/g, ' ');
              summary = `কমান্ড রান: ${cmdPreview}`;
            } else if (tc.name === 'read_file' && args.Path) {
              summary = `ফাইল পড়া হচ্ছে: ${path.basename(args.Path)}`;
            } else if (tc.name === 'edit_file' && args.Path) {
              summary = `এডিট হচ্ছে: ${path.basename(args.Path)}`;
            } else if (tc.name === 'write_file' && args.Path) {
              summary = `তৈরি হচ্ছে: ${path.basename(args.Path)}`;
            } else if (tc.name === 'search_web' && args.query) {
              summary = `ওয়েব সার্চ: ${String(args.query).substring(0, 30)}`;
            } else if (tc.name === 'schedule') {
              continue;
            } else {
              summary = tc.name;
            }

            if (summary && isWorking) {
              updateLiveProgress(summary);
            }
          }
        }

        // 2. Final Content Response
        if (entry.type === 'PLANNER_RESPONSE' && entry.status === 'DONE' && entry.content && entry.content.trim() && entry.step_index > lastStepSent) {
          lastStepSent = entry.step_index;
          log(`[Delivering Final Reply #${entry.step_index} to Telegram...]`);

          if (currentProgressMsgId) {
            editTelegram(ADMIN_CHAT_ID, currentProgressMsgId, '✅ Antigravity কাজ সফলভাবে সম্পন্ন করেছে!\n\nনিচে বিস্তারিত ফলাফল দেওয়া হলো:');
          }
          stopWorking();

          sendTelegram(ADMIN_CHAT_ID, `🤖 Antigravity এর ফলাফল:\n\n${entry.content.trim()}`);
        }
      } catch (e) {}
    }
  } catch (e) {
    log('pollTranscript error: ' + e.message);
  }
}

setInterval(pollTranscript, 800);

// Channel Auto-Post Pinger
setInterval(() => {
  fetch('https://earnpulse-beta.vercel.app/api/telegram-cron', { signal: AbortSignal.timeout(8000) }).catch(() => {});
}, 10 * 60 * 1000);

function getUptimeString() {
  const sec = Math.floor(process.uptime());
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h > 0 ? h + ' ঘণ্টা ' : ''}${m} মিনিট ${s} সেকেন্ড`;
}

// -------------------------------------------------------------
// 6. TELEGRAM LONG POLLING LOOP
// -------------------------------------------------------------
let offset = 0;
async function pollTelegram() {
  log('Listening for Telegram messages in 100% Silent Mode...');

  while (true) {
    try {
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=20`;
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      const json = await res.json();

      if (json.ok && Array.isArray(json.result)) {
        for (const update of json.result) {
          offset = update.update_id + 1;
          const msg = update.message;
          if (!msg) continue;

          let hasPhoto = false;
          let photoLocalPath = null;
          if (Array.isArray(msg.photo) && msg.photo.length > 0) {
            hasPhoto = true;
            const largest = msg.photo[msg.photo.length - 1];
            photoLocalPath = await downloadTelegramFile(largest.file_id);
          } else if (msg.document && msg.document.mime_type && msg.document.mime_type.startsWith('image/')) {
            hasPhoto = true;
            photoLocalPath = await downloadTelegramFile(msg.document.file_id);
          }

          const rawText = (msg.text || msg.caption || '').trim();
          if (!rawText && !hasPhoto) continue;

          const displayText = rawText || (hasPhoto ? '📷 [ছবি পাঠানো হয়েছে]' : '');
          const senderId = msg.chat.id;
          const senderName = msg.from ? (msg.from.first_name || msg.from.username) : 'Owner';

          log(`[Telegram Update] From: ${senderName} (${senderId}) -> "${displayText}" (photo=${hasPhoto})`);

          if (String(senderId) !== String(ADMIN_CHAT_ID)) {
            await sendTelegram(senderId, '⛔ দুঃখিত, আপনি এই বটের অনুমোদিত মালিক নন।');
            continue;
          }

          const isReady = await isAntigravityReady();
          const lowerText = rawText.toLowerCase();

          // If Antigravity IDE is closed or not ready on PC
          if (!isReady) {
            await sendTelegram(senderId, '🔴 Antigravity বর্তমানে অফলাইন রয়েছে (পিসিতে সফটওয়্যারটি বন্ধ করা হয়েছে বা ইঞ্জিন লোড হচ্ছে)।\n\nকাজ করার জন্য দয়া করে পিসিতে Antigravity ওপেন করুন। সফটওয়্যার ওপেন করলেই সাথে সাথে অনলাইন হয়ে যাবে!');
            continue;
          }

          // Start command
          if (lowerText === '/start') {
            await sendTelegram(senderId, `👋 স্বাগতম বস ${senderName}!\n\nউপরে পিন করা মেসেজে দেখুন লাইভ স্ট্যাটাস দেখাচ্ছে: 🟢 অনলাইন।\n\nআপনি যেকোনো কাজ বা প্রশ্ন লিখে পাঠালে সাথে সাথে স্ক্রিনের মতো প্রতিটি স্টেপ লাইভ প্রগ্রেস দেখতে পাবেন!`);
            continue;
          }

          // Status command
          if (lowerText === '/status' || lowerText === 'status' || lowerText === 'online' || lowerText === 'offline') {
            await sendTelegram(senderId, `🟢 Antigravity স্ট্যাটাস: অনলাইন (Online)\n\n💻 পিসি ও এআই ইঞ্জিন: সম্পূর্ণ সচল ও প্রস্তুত\n⚡ রেসপন্স সিস্টেম: লাইভ প্রগ্রেস সক্রিয়\n📡 চ্যানেল অটো-পোস্ট: ২৪/৭ চালু\n⏰ ব্রিজ আপটাইম: ${getUptimeString()}\n\nপিসিতে Antigravity সক্রিয় রয়েছে। মোবাইল থেকেই যেকোনো কাজ পাঠাতে পারেন!`);
            continue;
          }

          // Regular Task / Instruction with or without Photo
          const notifyMsg = hasPhoto
            ? (rawText ? `⚡ ছবি ও নির্দেশ পাওয়া গেছে:\n"${rawText}"\n\n⏳ Antigravity কাজ শুরু করেছে...` : `⚡ ছবি পাওয়া গেছে! 📷\n\n⏳ Antigravity ইমেজ বিশ্লেষণ ও কাজ শুরু করেছে...`)
            : `⚡ নির্দেশ পাওয়া গেছে:\n"${rawText}"\n\n⏳ Antigravity কাজ শুরু করেছে...`;

          const initRes = await sendTelegram(senderId, notifyMsg);
          const progressMsgId = initRes?.result?.message_id;

          startWorking(senderId, progressMsgId);

          let promptMessage = '';
          if (photoLocalPath) {
            promptMessage = `[Telegram Photo Message]:\nPhoto File Path: ${photoLocalPath}\nCaption: ${rawText || '(No caption provided)'}`;
          } else {
            promptMessage = `[Telegram Message]: ${rawText}`;
          }

          const hubData = getActiveHubData();
          const childEnv = {
            ...process.env,
            USERPROFILE: 'C:\\Users\\Khalid Mama',
            HOME: 'C:\\Users\\Khalid Mama',
            APPDATA: 'C:\\Users\\Khalid Mama\\AppData\\Roaming',
            LOCALAPPDATA: 'C:\\Users\\Khalid Mama\\AppData\\Local',
            ANTIGRAVITY_LS_ADDRESS: hubData?.httpPort ? `localhost:${hubData.httpPort}` : (process.env.ANTIGRAVITY_LS_ADDRESS || 'localhost:49797'),
            ANTIGRAVITY_CSRF_TOKEN: hubData?.csrfToken || process.env.ANTIGRAVITY_CSRF_TOKEN || ''
          };

          // Robust delivery with retry loop (up to 8 attempts with 2.5s delay = 20s resilience)
          let delivered = false;
          for (let attempt = 1; attempt <= 8; attempt++) {
            const currentHub = getActiveHubData();
            if (currentHub && currentHub.httpPort) {
              childEnv.ANTIGRAVITY_LS_ADDRESS = `localhost:${currentHub.httpPort}`;
              childEnv.ANTIGRAVITY_CSRF_TOKEN = currentHub.csrfToken || '';
            }

            const deliverResult = await new Promise((resolve) => {
              execFile(AGENT_EXE, ['agentapi', 'send-message', '--title=Telegram_Message', CONVERSATION_ID, promptMessage], { windowsHide: true, env: childEnv }, (err, stdout, stderr) => {
                if (err) resolve({ ok: false, err, stderr, stdout });
                else resolve({ ok: true, stdout });
              });
            });

            if (deliverResult.ok) {
              delivered = true;
              log(`Message delivered to Antigravity turn successfully on attempt ${attempt}!`);
              break;
            }

            log(`agentapi attempt ${attempt}/8 failed. err: ${deliverResult.err?.message} | stdout: ${deliverResult.stdout} | stderr: ${deliverResult.stderr}`);
            if (attempt < 8) {
              await new Promise(r => setTimeout(r, 2500));
            }
          }

          if (!delivered) {
            log('Failed to deliver message to Antigravity after 8 attempts');
            stopWorking();
            const readyAfter = await isAntigravityReady();
            if (readyAfter) {
              await sendTelegram(senderId, '⚠️ Antigravity এআই ইঞ্জিন বর্তমানে একটি কাজ সম্পন্ন করছে বা সাময়িক রিলোড হচ্ছে।\n\nঅনুগ্রহ করে ১৫-২০ সেকেন্ড পর মেসেজটি আবার দিন।');
            } else {
              await sendTelegram(senderId, '🔴 পিসিতে Antigravity সফটওয়্যার বন্ধ রয়েছে। কাজ সম্পন্ন করতে Antigravity ওপেন করুন।');
            }
          }
        }
      }
    } catch (e) {
      log('pollTelegram network error: ' + e.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

pollTelegram();
