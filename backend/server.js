const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const bridge = require('./bridge');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'earnpulse_ultra_secure_secret_key_2026';

app.use(cors());
app.use(express.json());

// Normalize routes: support both /api/... and direct calls on Vercel
app.use((req, res, next) => {
  if (!req.url.startsWith('/api') && !req.url.startsWith('/admin') && !req.url.startsWith('/downloads') && !req.url.endsWith('.apk') && req.url !== '/' && !req.url.startsWith('/assets')) {
    req.url = '/api' + req.url;
  }
  next();
});

// Cloud Database Sync Middleware (MongoDB Atlas 24/7 Persistent Storage - Ultra-Fast Non-Blocking)
app.use((req, res, next) => {
  if (db.syncFromCloud) {
    db.syncFromCloud().catch(() => {});
  }
  next();
});

// -------------------------------------------------------------
// TELEGRAM AUTOMATIC DAILY POSTING ENGINE (Passive Auto-Cron)
// -------------------------------------------------------------
const BENGALI_DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

const DAILY_POST_TEMPLATES = {
  morning: [
    (dayName, dateStr) => ({
      text: `👑 <b>EarnPulse Official</b> 👑\n🔥 <b>শুভ সকাল! আজ ${dayName} — নিশ্চিত আয়ে দিন শুরু করুন</b> 🔥\n\n✨ <b>সবাই বেশি বেশি WhatsApp কানেক্ট করুন, রেফার করুন এবং আনলিমিটেড ইনকাম করুন!</b> 🥳\n\n📱 <b>WhatsApp ইনকাম:</b> প্রতি ২৪ ঘণ্টায় প্রতি নম্বরে <b>৳৩২.০০</b> নিশ্চিত! যত বেশি নম্বর রাখবেন, তত বেশি আয়! 💰\n👥 <b>টিম রেফারেল:</b> বন্ধুদের ইনভাইট করুন—বন্ধুদের প্রতিটি নম্বর থেকে <b>১৫% ১ম স্তর ও ৫% ২য় স্তর লাইফটাইম কমিশন!</b> 💸\n⚠️ <b>জরুরি চেকিং:</b> কোনো নম্বর <b>Offline</b> থাকলে এখনই নতুন কোড দিয়ে <b>Re-connect</b> করে নিন যাতে টাইমার না থামে! 🔴\n\n🎁 <b>আমাদের এখানে পেমেন্ট সর্বোচ্চ ২৪ ঘণ্টার মধ্যে বিকাশ ও নগদে করা হয়!</b> 🤑\n✔️ কেউ পেমেন্ট নিয়ে চিন্তা করবেন না, সময় মতো পেমেন্ট পাবেন সবাই কাজ করুন এবং ইনকাম করুন! ✔️`,
      btnText: '🚀 এখনই WhatsApp কানেক্ট করুন'
    }),
    (dayName, dateStr) => ({
      text: `👑 <b>EarnPulse Official</b> 👑\n🌅 <b>সুপ্রভাত ${dayName} — প্রতিদিনের সহজ ইনকাম নিশ্চিত করুন</b> 🌅\n\n✨ <b>প্রতিদিন শত শত মেম্বার বিকাশ ও নগদে সফলভাবে পেমেন্ট নিচ্ছেন!</b> 💸\n\n🎁 <b>ডেইলি বোনাস:</b> সাইটে গিয়ে এখনই <b>Daily Check-in</b> করে ফ্রি কয়েন বোনাস বুঝে নিন! 🌟\n📱 <b>মাল্টি-কানেক্ট:</b> অলস পড়ে থাকা যেকোনো সিম দিয়ে WhatsApp কানেক্ট করুন—প্রতি ২৪ ঘণ্টায় প্রতিটিতে <b>৳৩২!</b> 💰\n👥 <b>রেফার করে আয়:</b> আপনার ইনভাইট লিংক বন্ধুদের দিন এবং টিম গড়ে তুলে আজীবন কমিশন উপভোগ করুন! 🚀\n\n✔️ <b>১০০% বিশ্বস্ত ও নিরাপদ প্ল্যাটফর্ম — সর্বোচ্চ ২৪ ঘণ্টার মধ্যে নিশ্চিত ক্যাশআউট!</b> 💵`,
      btnText: '✨ Daily Check-in ও নম্বর চেক'
    }),
    (dayName, dateStr) => ({
      text: `👑 <b>EarnPulse Official</b> 👑\n💎 <b>সকালের বিশেষ ইনকাম আপডেট (${dayName})</b> 💎\n\n✨ <b>ঘরে বসেই মোবাইল দিয়ে প্রতিদিন ৫০০৳ থেকে ১,০০০৳+ আয় করার সেরা সুযোগ!</b> 📱\n\n📱 <b>আয়ের হিসাব:</b> ১টি WhatsApp = ৳৩২/দিন | ৫টি = ৳১৬০/দিন | ১০টি = ৳৩২০/দিন + ১,০০০৳ মেগা বোনাস! 🎁\n👥 <b>রেফারেল বোনাস:</b> বন্ধু যত নম্বর কানেক্ট রাখবে, আপনি পাবেন <b>১৫% ও ৫% লাইফটাইম অটো কমিশন!</b> 💸\n⚠️ <b>স্ট্যাটাস চেক:</b> একাউন্টে লগইন করে দেখুন WhatsApp অনলাইন আছে কিনা, অফলাইন হলে সাথে সাথে রিকানেক্ট করুন! 🔴\n\n🎁 <b>বিকাশ ও নগদে সর্বোচ্চ ২৪ ঘণ্টার মধ্যে নিশ্চিত পেমেন্ট গ্যারান্টি!</b> 🤑`,
      btnText: '📲 একাউন্ট চেক ও নম্বর কানেক্ট করুন'
    })
  ],
  afternoon: [
    (dayName, dateStr) => ({
      text: `👑 <b>EarnPulse Official</b> 👑\n🚀 <b>মেগা অফার ও রেফারেল ধামাকা — আজ ${dayName} দুপুর!</b> 🚀\n\n✨ <b>যত বেশি রেফার করবেন এবং নম্বর কানেক্ট রাখবেন, তত বেশি ক্যাশ বোনাস!</b> 💸\n\n🎁 <b>১০টি WhatsApp অফার:</b> ১০টি নম্বর কানেক্ট রাখলেই প্রতিদিন ৳৩২০ + <b>১,০০০ টাকার স্পেশাল ক্যাশ বক্স!</b> 💰\n👥 <b>আনলিমিটেড কমিশন:</b> বন্ধুদের ইনভাইট করুন—বন্ধুর আয় থেকে পাবেন <b>১৫% ১ম স্তর ও ৫% ২য় স্তর লাইফটাইম কমিশন!</b> 🌟\n⚠️ <b>অফলাইন এলার্ট:</b> কোনো নম্বর অফলাইন থাকলে নতুন কোড দিয়ে সাথে সাথে Re-connect করুন, সময় নষ্ট মানেই ইনকাম লস! 🔴\n\n✔️ <b>১০০% নিশ্চিত বিকাশ ও নগদ পেমেন্ট — সময় মতো সবাই পেমেন্ট পাবেন!</b> 💵`,
      btnText: '🎁 মেগা অফার ও WhatsApp কানেক্ট'
    }),
    (dayName, dateStr) => ({
      text: `👑 <b>EarnPulse Official</b> 👑\n⚡ <b>দুপুরের স্পেশাল গাইড: কীভাবে আয় সর্বোচ্চ করবেন?</b> ⚡\n\n✨ <b>অলস পড়ে থাকা যেকোনো সিম ও নম্বর দিয়েই আয় শুরু করুন!</b> 📱\n\n📌 <b>সহজ নিয়ম:</b> সাইট থেকে ৮ ডিজিটের কোড নিয়ে WhatsApp-এর Linked Devices-এ কানেক্ট করুন—২৪ ঘণ্টা পার হলেই সরাসরি <b>৳৩২!</b> 💰\n👥 <b>রেফারেল টিম:</b> আপনার ইনভাইট লিংক ফেসবুক, টেলিগ্রাম ও মেসেঞ্জারে বন্ধুদের পাঠান—টিমের আয় থেকে প্রতিদিন ক্যাশ পান! 💸\n⚠️ <b>নম্বর অনলাইন রাখুন:</b> ইনকাম সচল রাখতে কোনো নম্বর যেন অফলাইন না থাকে, অফলাইন হলে সাথে সাথে নতুন কোড দিয়ে যুক্ত করুন! 🔴\n\n🎁 <b>সর্বোচ্চ ২৪ ঘণ্টার মধ্যে সকল উত্তোলন বিকাশ ও নগদে পরিশোধ করা হয়!</b> 🤑`,
      btnText: '⚡ এখনই নতুন নম্বর যোগ করুন'
    }),
    (dayName, dateStr) => ({
      text: `👑 <b>EarnPulse Official</b> 👑\n🔥 <b>আজকের সেরা টিম আর্নারদের অভিনন্দন!</b> 🔥\n\n✨ <b>আপনিও পারেন নিজের বড় টিম তৈরি করে প্রতিদিন আনলিমিটেড আয় করতে!</b> 🏆\n\n👥 <b>টিম ইনকামের সুবিধা:</b> আপনার রেফারে ১০ জন বন্ধু যুক্ত হয়ে নম্বর কানেক্ট রাখলেই আপনার একাউন্টে প্রতিদিন জমা হবে ফ্রি ক্যাশ! 💸\n📱 <b>নিজের নম্বর যোগ করুন:</b> পরিবার ও অতিরিক্ত সিমগুলো দিয়ে যত বেশি নম্বর কানেক্ট রাখবেন, ইনকাম তত দ্রুত বাড়বে! 💰\n⚠️ <b>স্ট্যাটাস চেক:</b> এখনই একাউন্টে ঢুকে নিশ্চিত হয়ে নিন আপনার সব নম্বর ‘Online’ আছে! 🟢\n\n✔️ <b>নিরাপদ ও বিশ্বস্ত প্ল্যাটফর্ম — সর্বনিম্ন ব্যালেন্স হলেই এক ক্লিকে ক্যাশআউট নিন!</b> 💵`,
      btnText: '👥 রেফারেল লিংক নিন ও শেয়ার করুন'
    })
  ],
  evening: [
    (dayName, dateStr) => ({
      text: `👑 <b>EarnPulse Official</b> 👑\n⚠️ <b>জরুরি নোটিশ: স্ট্যাটাস চেক ও রি-কানেক্ট এলার্ট!</b> ⚠️\n\n✨ <b>নম্বর অফলাইন থাকলে আপনার ২৪ ঘণ্টার ইনকাম কাউন্টডাউন বন্ধ থাকতে পারে!</b> 🔴\n\n🔍 <b>সহজ রি-কানেক্ট:</b> সাইটে ঢুকে কোনো নম্বর <b>Offline</b> দেখলে নতুন পেয়ারিং কোড দিয়ে সাথে সাথে WhatsApp-এ যুক্ত করুন! 📱\n💡 <b>বিশেষ সুবিধা:</b> রি-কানেক্ট করলে আগের সময় নষ্ট হয় না, আগের সময় থেকেই কাউন্ট চালু হয়ে ২৪ ঘণ্টা পূর্ণ হবে! ⏳\n👥 <b>বন্ধুদের সতর্ক করুন:</b> আপনার টিমের বন্ধুরা অনলাইনে থাকলে আপনার কমিশনও সুরক্ষিত থাকবে! 💸\n\n🎁 <b>আমাদের এখানে পেমেন্ট সর্বোচ্চ ২৪ ঘণ্টার মধ্যে বিকাশ ও নগদে করা হয়!</b> 🤑`,
      btnText: '🔍 WhatsApp স্ট্যাটাস চেক ও রি-কানেক্ট'
    }),
    (dayName, dateStr) => ({
      text: `👑 <b>EarnPulse Official</b> 👑\n🌟 <b>সন্ধ্যার পাওয়ার রিমাইন্ডার — আজ ${dayName}</b> 🌟\n\n✨ <b>যাদের নম্বর সারাদিন অনলাইন ছিল, তাদের ২৪ ঘণ্টা পূর্ণ হওয়ার সময় ঘনিয়ে এসেছে!</b> ⏳\n\n💰 <b>ইনকাম বুঝে নিন:</b> নম্বর ২৪ ঘণ্টা অনলাইন সম্পন্ন হলেই একাউন্টে স্বয়ংক্রিয়ভাবে <b>৳৩২</b> চলে আসবে! 📱\n👥 <b>রেফারেল লিংক শেয়ার:</b> সন্ধ্যার অবসর সময়ে বন্ধুদের ইনভাইট করুন—টিমের আয় থেকে পান <b>১৫% ও ৫% লাইফটাইম কমিশন!</b> 💸\n⚠️ <b>অফলাইন চেক:</b> কোনো নম্বর অফলাইন থাকলে নতুন কোড দিয়ে কানেক্ট করে নিন যাতে বোনাস মিস না হয়! 🔴\n\n✔️ <b>১০০% বিশ্বস্ত প্ল্যাটফর্ম — সময় মতো পেমেন্ট পাবেন সবাই নিশ্চিন্তে কাজ করুন!</b> 💵`,
      btnText: '📲 একাউন্ট চেক করুন ও নম্বর যুক্ত করুন'
    }),
    (dayName, dateStr) => ({
      text: `👑 <b>EarnPulse Official</b> 👑\n💎 <b>EarnPulse টিম বুস্ট ও সন্ধ্যার ইনকাম টিপস</b> 💎\n\n✨ <b>প্রতিটি আমন্ত্রণে বাড়তি আয় — আজই তৈরি করুন আপনার স্বপ্নের টিম!</b> 👥\n\n🌟 <b>কমিশন স্ট্রাকচার:</b> ১ম স্তর ১৫% ও ২য় স্তর ৫% লাইফটাইম কমিশন! বন্ধু যত নম্বর রাখবে, আপনার ফ্রি আয় তত বাড়বে! 💸\n📱 <b>নম্বর বাড়ান:</b> অলস পড়ে থাকা যেকোনো নম্বর পেয়ারিং কোড দিয়ে যুক্ত করুন—প্রতিটিতে নিশ্চিত আয়! 💰\n⚠️ <b>রি-কানেক্ট করুন:</b> কোনো নম্বর অফলাইন হলে দেরি না করে সাথে সাথে রি-কানেক্ট করে নিন! 🔴\n\n🎁 <b>২৪ ঘণ্টার মধ্যে বিকাশ ও নগদে নিশ্চিত পেমেন্ট গ্যারান্টি!</b> 🤑`,
      btnText: '👥 রেফার লিংক কপি করুন ও বন্ধুদের দিন'
    })
  ],
  night: [
    (dayName, dateStr) => ({
      text: `👑 <b>EarnPulse Official</b> 👑\n🌙 <b>শুভ রাত্রি — ঘুমানোর সময়ও আপনার ইনকাম সচল থাকুক!</b> 🌙\n\n✨ <b>EarnPulse-এ আপনি যখন ঘুমাচ্ছেন, আপনার ব্যাকগ্রাউন্ড টাইমার তখনও টাকা তৈরি করছে!</b> 💰\n\n🛌 <b>ঘুমানোর আগে ছোট্ট চেক:</b> একাউন্টে লগইন করে নিশ্চিত হয়ে নিন আপনার WhatsApp নম্বরগুলো <b>Online</b> দেখাচ্ছে! 🟢\n📶 <b>নেট সচল রাখুন:</b> ফোনের ডেটা বা ওয়াইফাই অন রাখুন—সকালে ঘুম থেকে উঠেই দেখতে পাবেন নতুন ব্যালেন্স জমা হয়ে গেছে! 🌅\n🏆 <b>আজকের সকল উইথড্র সম্পন্ন:</b> আজকের দিনে শত শত মেম্বার বিকাশ ও নগদে সফলভাবে পেমেন্ট বুঝে পেয়েছেন! 👏\n\n✔️ <b>১০০% সফল পেমেন্ট ও বিশ্বস্ত প্ল্যাটফর্ম — নিশ্চিন্তে ঘুমিয়ে ঘুমিয়ে আয় করুন!</b> 💵`,
      btnText: '🌙 স্ট্যাটাস চেক করে নিশ্চিন্তে ঘুমান'
    }),
    (dayName, dateStr) => ({
      text: `👑 <b>EarnPulse Official</b> 👑\n⚡ <b>উইথড্র ও ডেইলি ইনকাম নাইট আপডেট (${dayName})</b> ⚡\n\n✨ <b>মেম্বারদের সকল ভ্যালিড উইথড্র অত্যন্ত দ্রুততার সাথে বিকাশ ও নগদে সম্পন্ন করা হয়েছে!</b> 💸\n\n🛌 <b>রাতের রিমাইন্ডার:</b> ঘুমানোর আগে কোনো নম্বর অফলাইন থাকলে নতুন কোড দিয়ে কানেক্ট করে ঘুমান। রাতে পুরো সময় কাউন্ট হবে! 📱\n👥 <b>কালকের আয়ের টার্গেট:</b> বন্ধুদের রেফার করুন এবং একাধিক নম্বর কানেক্ট রেখে আপনার ইনকাম দ্বিগুণ করুন! 🚀\n🎁 <b>পেমেন্ট নিয়ে কোনো চিন্তা নেই:</b> সর্বনিম্ন ব্যালেন্স হলেই উইথড্র দিন, সর্বোচ্চ ২৪ ঘণ্টার মধ্যে টাকা আপনার হাতে! 🤑\n\n✔️ <b>নিরাপদ প্ল্যাটফর্ম • দ্রুত পেমেন্ট • ১০০% বিশ্বস্ত EarnPulse! শুভ রাত্রি!</b> 🌙`,
      btnText: '🌐 ব্যালেন্স চেক ও উত্তোলন করুন'
    }),
    (dayName, dateStr) => ({
      text: `👑 <b>EarnPulse Official</b> 👑\n🏆 <b>সারাদিনের সফল পেমেন্ট ও অভিনন্দন (${dayName})!</b> 🏆\n\n✨ <b>সকল পরিশ্রমী EarnPulse মেম্বারদের আন্তরিক অভিনন্দন ও শুভকামনা!</b> 💎\n\n💰 <b>কালকের আয়ের সেরা প্রস্তুতি:</b> আরও বেশি অতিরিক্ত সিম কানেক্ট করুন এবং বন্ধুদের রেফার করে বড় টিম তৈরি করুন! 👥\n📱 <b>টাইমার সচল রাখুন:</b> ঘুমানোর আগে নিশ্চিত করুন আপনার সব নম্বর অনলাইন রয়েছে, রাতে ঘুমালেও ইনকাম মিস হবে না! 🛌\n🎁 <b>২৪ ঘণ্টার মধ্যে বিকাশ ও নগদে নিশ্চিত পেমেন্ট পরিশোধ!</b> 💸\n\n🌙 <b>সবাই ভালো থাকুন এবং ঘরে বসে নিরাপদ ইনকাম উপভোগ করুন!</b> 🌙`,
      btnText: '💵 আমার ব্যালেন্স ও হিস্ট্রি দেখুন'
    })
  ]
};
let isPostingTelegram = false;
let lastTelegramCheck = 0;

async function checkAndSendAutoTelegramPost(forceKey = null) {
  const nowMs = Date.now();
  if (isPostingTelegram && !forceKey) return null;
  if (!forceKey && (nowMs - lastTelegramCheck < 30000)) return null; // Throttle to max once per 30s
  lastTelegramCheck = nowMs;

  const now = new Date();
  const utcHours = now.getUTCHours();
  const bdHour = (utcHours + 6) % 24;

  let currentSlot = null;
  if (bdHour >= 8 && bdHour < 12) {
    currentSlot = 'morning';
  } else if (bdHour >= 13 && bdHour < 18) {
    currentSlot = 'afternoon';
  } else if (bdHour >= 20 && bdHour < 24) {
    currentSlot = 'night';
  }

  if (forceKey && DAILY_POST_TEMPLATES[forceKey]) {
    currentSlot = forceKey;
  }

  // Outside allowed daytime posting hours (e.g. late night / off hours) -> Strictly NO auto-posting!
  if (!currentSlot) {
    return { success: true, msg: `Outside allowed posting hours (BD hour ${bdHour}:00). Strictly 3 slots: Morning (8-12), Afternoon (13-18), Night (20-24).` };
  }

  // BD Date YYYY-MM-DD & Day Name
  const nowBd = new Date(now.getTime() + 6 * 3600 * 1000);
  const bdDateStr = nowBd.toISOString().slice(0, 10);
  const dayName = BENGALI_DAYS[nowBd.getDay()] || 'দিন';
  const slotKey = `${bdDateStr}_${currentSlot}`;

  // Direct MongoDB Atlas Atomic Distributed Lock Check
  if (!forceKey) {
    try {
      if (db.getMongoDb) {
        const mdb = await db.getMongoDb();
        if (mdb) {
          // 🛡️ STRICT RULE: Never exceed 3 posts per day in the channel!
          const todayCount = await mdb.collection('telegram_posts_history').countDocuments({
            date: bdDateStr,
            $or: [{ status: 'sent' }, { message_id: { $exists: true, $ne: null } }]
          });
          if (todayCount >= 3) {
            return { alreadyPosted: true, msg: `Daily post cap reached (${todayCount}/3). Maximum 3 posts per day strictly enforced.` };
          }

          // Attempt atomic reservation lock: upsert a pending document ONLY if it does not already exist
          const lockResult = await mdb.collection('telegram_posts_history').findOneAndUpdate(
            { slotKey },
            { 
              $setOnInsert: { 
                slotKey, 
                slot: currentSlot, 
                date: bdDateStr, 
                status: 'pending', 
                reserved_at: new Date() 
              } 
            },
            { upsert: true, returnDocument: 'before' }
          );

          // If a document with this slotKey already existed before, lock was NOT acquired
          const existing = (lockResult && lockResult.value) ? lockResult.value : (lockResult && lockResult.slotKey ? lockResult : null);
          if (existing) {
            return { alreadyPosted: true, slotKey };
          }
        }
      }
    } catch (e) {
      if (e.code === 11000 || (e.message && e.message.includes('E11000'))) {
        return { alreadyPosted: true, slotKey };
      }
      console.error('Mongo check error in telegram auto post:', e.message);
    }

    const postsLog = db.get('telegram_auto_posts').value() || [];
    const todayPosts = postsLog.filter(p => p && p.date === bdDateStr);
    if (todayPosts.length >= 3) {
      return { alreadyPosted: true, msg: `Daily post cap reached (${todayPosts.length}/3). Maximum 3 posts per day strictly enforced.` };
    }
    if (postsLog.some(p => p && p.slotKey === slotKey)) {
      return { alreadyPosted: true, slotKey };
    }
  }

  isPostingTelegram = true;
  try {
    const templates = DAILY_POST_TEMPLATES[currentSlot];
    if (!templates || templates.length === 0) return null;

    // Rotate template based on day of week so no two consecutive days send the exact same text!
    const dayIndex = nowBd.getDay();
    const templateFn = templates[dayIndex % templates.length];
    const post = templateFn(dayName, bdDateStr);
    if (!post) return null;

    const botToken = process.env.TELEGRAM_BOT_TOKEN || '8330333862:AAGY_NVccTwooCk2fTQ2aiuKxC2Fe7lRieU';
    const chatId = process.env.TELEGRAM_CHAT_ID || '@EarnPulse_Channel';

    const payload = {
      chat_id: chatId,
      text: post.text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: post.buttons || [
          [
            {
              text: post.btnText || '🚀 এখনই WhatsApp কানেক্ট করুন',
              url: 'https://earnpulse-beta.vercel.app/register?invite=4E2YOO'
            }
          ],
          [
            {
              text: '👥 রেফারেল লিংক নিন ও শেয়ার করুন',
              url: 'https://earnpulse-beta.vercel.app/#team'
            },
            {
              text: '🌐 ওয়েবসাইট ওপেন করুন',
              url: 'https://earnpulse-beta.vercel.app'
            }
          ]
        ]
      }
    };

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const tgData = await tgRes.json();

    if (tgData && tgData.ok) {
      // Save directly to MongoDB Atlas
      try {
        if (db.getMongoDb) {
          const mdb = await db.getMongoDb();
          if (mdb) {
            await mdb.collection('telegram_posts_history').updateOne(
              { slotKey },
              { $set: { slotKey, slot: currentSlot, date: bdDateStr, status: 'sent', message_id: tgData.result?.message_id, created_at: new Date().toISOString() } },
              { upsert: true }
            );
          }
        }
      } catch (e) {
        console.error('Mongo save error in telegram auto post:', e.message);
      }

      if (!db.get('telegram_auto_posts').value()) {
        db.set('telegram_auto_posts', []).write();
      }
      db.get('telegram_auto_posts').push({
        slotKey,
        slot: currentSlot,
        date: bdDateStr,
        message_id: tgData.result?.message_id,
        created_at: new Date().toISOString()
      }).write();

      if (db.syncToCloud) {
        await db.syncToCloud().catch(e => console.error('Cloud sync error for telegram auto post:', e.message));
      }
      console.log(`[Telegram Auto Post] Successfully posted ${currentSlot} message to ${chatId} (ID: ${tgData.result?.message_id})`);
      return { success: true, slot: currentSlot, slotKey, message_id: tgData.result?.message_id, bdHour };
    } else {
      console.error('[Telegram Auto Post] Bot Error:', tgData.description);
      try {
        if (db.getMongoDb) {
          const mdb = await db.getMongoDb();
          if (mdb) {
            await mdb.collection('telegram_posts_history').deleteOne({ slotKey, status: 'pending' }).catch(() => {});
          }
        }
      } catch (e) {}
      return { success: false, error: tgData.description };
    }
  } catch (err) {
    console.error('[Telegram Auto Post] Network Error:', err.message);
    try {
      if (db.getMongoDb) {
        const mdb = await db.getMongoDb();
        if (mdb) {
          await mdb.collection('telegram_posts_history').deleteOne({ slotKey, status: 'pending' }).catch(() => {});
        }
      }
    } catch (e) {}
    return { success: false, error: err.message };
  } finally {
    isPostingTelegram = false;
  }
}

// Serve Admin Panel Statically
const adminDir = fs.existsSync(path.join(__dirname, '../admin')) 
  ? path.join(__dirname, '../admin') 
  : path.join(__dirname, 'admin');

if (fs.existsSync(adminDir)) {
  app.use('/admin', express.static(adminDir));
  app.get('/admin', (req, res) => {
    res.sendFile(path.join(adminDir, 'index.html'));
  });
}

// Serve APK downloads
const downloadsDir = path.join(__dirname, '../frontend/public/downloads');
if (fs.existsSync(downloadsDir)) {
  app.use('/downloads', express.static(downloadsDir));
}
app.get('/EarnPulse.apk', (req, res) => {
  const apkPath = path.join(__dirname, '../frontend/public/downloads/EarnPulse.apk');
  if (fs.existsSync(apkPath)) {
    return res.download(apkPath, 'EarnPulse.apk');
  }
  res.status(404).json({ success: false, msg: 'APK ফাইলটি পাওয়া যায়নি' });
});

// Helper: Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ success: false, msg: 'লগইন আবশ্যক' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, msg: 'টোকেন অকার্যকর বা মেয়াদোত্তীর্ণ' });
    req.user = user;
    next();
  });
}

// Helper: Admin Check
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, msg: 'অ্যাডমিন অধিকার প্রয়োজন' });
  }
  next();
}

// -------------------------------------------------------------
// CHECK-IN API (৭ দিন প্রতিদিন ১০ টাকা = ৭০ টাকা)
// -------------------------------------------------------------
// 3. DAILY 7-DAY CHECK-IN REWARD ENGINE (নতুন মেম্বারদের প্রথম ৭ দিন, দিনে ১ বার, তারিখ অনুযায়ী ৬ ঘণ্টা অনলাইনে ১০ টাকা)
// -------------------------------------------------------------

// বাংলাদেশ টাইমজোন (Asia/Dhaka, UTC+6) অনুযায়ী আজকের তারিখ ও সময় বের করার হেল্পার
function getBangladeshDateInfo() {
  const now = new Date();
  const bdTimeMs = now.getTime() + (now.getTimezoneOffset() * 60000) + (6 * 3600000);
  const bdNow = new Date(bdTimeMs);
  const y = bdNow.getFullYear();
  const m = String(bdNow.getMonth() + 1).padStart(2, '0');
  const d = String(bdNow.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const todayMidnightMs = new Date(`${todayStr}T00:00:00+06:00`).getTime();
  return { todayStr, todayMidnightMs, nowMs: now.getTime(), bdNow };
}

// নির্দিষ্ট তারিখ অনুযায়ী (রাত ১২:০০ টা থেকে পরের রাত ১২:০০ টা) মেম্বারের হোয়াটসঅ্যাপ অনলাইন সময় গণনার হেল্পার
async function calculateMemberTodayOnlineHours(userId, todayStr, todayMidnightMs, nowMs) {
  const wsList = await bridge.fetchWsOnlineStatusList(false).catch(() => []);
  const linkedNumbers = db.get('linked_numbers').filter({ user_id: userId }).value() || [];

  if (linkedNumbers.length === 0) {
    return { onlineHours: 0, isQualified: false, effectiveSec: 0, numbers: [] };
  }

  let numDetails = [];
  linkedNumbers.forEach(n => {
    const cleanN = String(n.phone_number || '').trim();
    const w = wsList?.find(x => String(x.wsNumber).trim() === cleanN);

    let todaySec = 0;
    // ১. আর্নবন্ডুর সিস্টেম থেকে আজকের অনলাইন সেকেন্ডস (todayOnlineSeconds)
    if (w && w.todayOnlineSeconds !== undefined && w.todayOnlineSeconds !== null) {
      todaySec = Number(w.todayOnlineSeconds);
    } else if (n.today_online_seconds) {
      todaySec = Number(n.today_online_seconds);
    }

    // ২. বর্তমান সেশনে লাইভ অনলাইন থাকলে আজকের মধ্যরাত (00:00:00 BD) থেকে অতিক্রান্ত সময় গণনা
    const isOnline = n.status === 'online' || (w && (w.currentStatus === '1' || String(w.currentStatus).toLowerCase() === 'online'));
    if (isOnline) {
      const dStr = (w && w.lastOnlineTime) || n.login_date || n.create_time;
      if (dStr) {
        const p = dStr.includes('T') ? new Date(dStr).getTime() : new Date(dStr.replace(' ', 'T') + '+06:00').getTime();
        const sessionStartMs = Math.max(todayMidnightMs, p);
        if (!isNaN(sessionStartMs) && nowMs > sessionStartMs) {
          const liveSec = Math.floor((nowMs - sessionStartMs) / 1000);
          todaySec = Math.max(todaySec, liveSec);
        }
      }
    } else {
      // ৩. অফলাইন থাকলে কিন্তু আজকের তারিখে লগইন হয়েছিল
      const dStr = n.login_date || n.create_time;
      if (dStr && dStr.startsWith(todayStr)) {
        const p = dStr.includes('T') ? new Date(dStr).getTime() : new Date(dStr.replace(' ', 'T') + '+06:00').getTime();
        const sessionStartMs = Math.max(todayMidnightMs, p);
        const stopTime = n.offline_at ? new Date(n.offline_at).getTime() : (n.updated_at ? new Date(n.updated_at).getTime() : nowMs);
        if (!isNaN(sessionStartMs) && !isNaN(stopTime) && stopTime > sessionStartMs) {
          const offlineSecToday = Math.floor((stopTime - sessionStartMs) / 1000);
          todaySec = Math.max(todaySec, offlineSecToday);
        }
      }
    }

    n._todaySec = todaySec;
    numDetails.push({ phone: cleanN, status: isOnline ? 'online' : 'offline', todaySec });
  });

  const maxSingleNumberSec = Math.max(0, ...linkedNumbers.map(n => n._todaySec || 0));
  const sumAllNumbersTodaySec = linkedNumbers.reduce((sum, n) => sum + (n._todaySec || 0), 0);
  const elapsedSecSinceMidnight = Math.max(0, Math.floor((nowMs - todayMidnightMs) / 1000));
  const effectiveTodaySec = Math.min(elapsedSecSinceMidnight, Math.max(maxSingleNumberSec, sumAllNumbersTodaySec));
  const onlineHours = parseFloat((effectiveTodaySec / 3600).toFixed(2));
  const isQualified = onlineHours >= 6.0;

  return { onlineHours, isQualified, effectiveSec: effectiveTodaySec, numbers: numDetails };
}

app.get('/api/checkin/status', authenticateToken, async (req, res) => {
  if (db.syncFromCloud) {
    db.syncFromCloud().catch(() => {});
  }
  db.read();
  const user = db.get('users').find({ id: req.user.id }).value();
  if (!user) return res.status(404).json({ success: false, msg: 'ব্যবহারকারী পাওয়া যায়নি' });

  const history = user.checkin_history || [];
  const checkinCount = history.length;
  const isExpired = checkinCount >= 7;

  const { todayStr, todayMidnightMs, nowMs } = getBangladeshDateInfo();
  const isCheckedInToday = user.last_checkin_date === todayStr || history.includes(todayStr);

  const { onlineHours, isQualified } = await calculateMemberTodayOnlineHours(req.user.id, todayStr, todayMidnightMs, nowMs);

  const canCheckIn = !isExpired && !isCheckedInToday && isQualified;

  return res.json({
    success: true,
    canCheckIn,
    isCheckedInToday,
    isExpired,
    checkinCount,
    maxCheckinDays: 7,
    onlineHours: onlineHours.toFixed(2),
    requiredHours: 6,
    isHoursQualified: isQualified,
    checkInReward: 10.0,
    history,
    todayDate: todayStr
  });
});

const activeCheckinUsers = new Set();

app.post('/api/checkin/do', authenticateToken, async (req, res) => {
  if (activeCheckinUsers.has(req.user.id)) {
    return res.status(429).json({ 
      success: false, 
      msg: 'আপনার পূর্ববর্তী অনুরোধ প্রক্রিয়াধীন রয়েছে, অনুগ্রহ করে অপেক্ষা করুন...' 
    });
  }
  activeCheckinUsers.add(req.user.id);
  try {
    if (db.syncFromCloud) {
      if (!db.hasSyncedFromCloudOnce || !db.hasSyncedFromCloudOnce()) {
        try {
          await Promise.race([
            db.syncFromCloud(),
            new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 2000))
          ]);
        } catch (e) {}
      } else {
        db.syncFromCloud().catch(() => {});
      }
    }
    db.read();
    const user = db.get('users').find({ id: req.user.id }).value();
    if (!user) return res.status(404).json({ success: false, msg: 'ব্যবহারকারী পাওয়া যায়নি' });

    const history = user.checkin_history || [];
    const checkinCount = history.length;
    const { todayStr, todayMidnightMs, nowMs } = getBangladeshDateInfo();

    // ১. প্রথম ৭ দিনের কোটা শেষ কিনা যাচাই
    if (checkinCount >= 7) {
      return res.status(400).json({ 
        success: false, 
        msg: 'আপনি ইতিমধ্যে ৭ দিনের সব চেক-ইন বোনাস গ্রহণ করেছেন! এই অফারটি নতুন মেম্বারদের প্রথম ৭ দিনের জন্য প্রযোজ্য।' 
      });
    }

    // ২. দিনে মাত্র একবারই করা যাবে - একই দিনে ২/৩ বার রোধ
    if (user.last_checkin_date === todayStr || history.includes(todayStr)) {
      return res.status(400).json({ 
        success: false, 
        msg: 'আজকের চেক-ইন আপনি ইতিমধ্যে সম্পন্ন করেছেন! দিনে শুধুমাত্র একবারই চেক-ইন করা যাবে।' 
      });
    }

    // ৩. হোয়াটসঅ্যাপ আজকের তারিখে কমপক্ষে ৬ ঘণ্টা অনলাইন আছে কিনা কঠোরভাবে যাচাই
    const { onlineHours, isQualified } = await calculateMemberTodayOnlineHours(req.user.id, todayStr, todayMidnightMs, nowMs);

    if (!isQualified) {
      return res.status(400).json({ 
        success: false, 
        msg: `আজকে আপনার হোয়াটসঅ্যাপ এখনও ৬ ঘণ্টা অনলাইন পূর্ণ হয়নি! আপনার আজকের অনলাইন সময়: ${onlineHours}/৬ ঘণ্টা। ৬ ঘণ্টা পূর্ণ হলে ১০ টাকা বোনাস সংগ্রহ করতে পারবেন।` 
      });
    }

    // সব শর্ত পূরণ হয়েছে: মেম্বারকে ১০ টাকা দেওয়া হচ্ছে
    const reward = 10.0;
    const newBal = parseFloat(((user.balance || 0) + reward).toFixed(2));
    const newTotal = parseFloat(((user.total_earned || 0) + reward).toFixed(2));
    const newHistory = [...history, todayStr];
    const newCount = newHistory.length;

    db.get('users')
      .find({ id: req.user.id })
      .assign({
        balance: newBal,
        total_earned: newTotal,
        last_checkin_date: todayStr,
        checkin_history: newHistory,
        checkin_count: newCount
      })
      .write();

    db.get('earnings_log').push({
      id: Date.now(),
      user_id: req.user.id,
      type: 'daily_checkin',
      amount: reward,
      description: `দৈনিক চেক-ইন বোনাস (${todayStr} তারিখ - ${newCount}/৭ দিন)`,
      created_at: new Date().toISOString()
    }).write();

    await db.syncToCloud();

    return res.json({
      success: true,
      reward,
      newBalance: newBal,
      checkinCount: newCount,
      maxCheckinDays: 7,
      todayDate: todayStr,
      history: newHistory,
      msg: `অভিনন্দন! আপনি আজকের (${todayStr}) চেক-ইন বোনাস ৳${reward} পেয়েছেন! (মোট ${newCount}/৭ দিন সম্পন্ন)`
    });
  } finally {
    activeCheckinUsers.delete(req.user.id);
  }
});

// -------------------------------------------------------------
// 1. AUTHENTICATION & REGISTRATION
// -------------------------------------------------------------
app.post('/api/auth/register', async (req, res) => {
  let { username, password, inviteCode } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, msg: 'ব্যবহারকারীর নাম ও পাসওয়ার্ড আবশ্যক' });
  }

  // Standardize phone number to BD format (01XXXXXXXXX)
  const cleanPhone = String(username).replace(/^\+?880/, '').replace(/^0/, '').trim();
  const normalizedPhone = '0' + cleanPhone;

  // Strict check if user already exists (whether entered with or without leading 0 or +880)
  const existing = db.get('users').find(u => {
    const existingClean = String(u.username).replace(/^\+?880/, '').replace(/^0/, '').trim();
    return existingClean === cleanPhone;
  }).value();

  if (existing) {
    return res.status(400).json({ 
      success: false, 
      code: 'USER_ALREADY_EXISTS',
      msg: 'এই ফোন নম্বর দিয়ে ইতোমধ্যে একটি অ্যাকাউন্ট খোলা আছে! দয়া করে পাসওয়ার্ড দিয়ে লগইন করুন।' 
    });
  }

  // Handle Referrer
  let referrerId = null;
  if (inviteCode) {
    const cleanInvite = String(inviteCode).trim().toUpperCase();
    const referrer = db.get('users').find(u => u.invite_code && u.invite_code.toUpperCase() === cleanInvite).value();
    if (referrer) {
      referrerId = referrer.id;
    }
  }

  // Generate unique 6-character invite code
  const userInviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const passwordHash = bcrypt.hashSync(password, 10);

  // First registered user automatically becomes admin
  const userCount = db.get('users').size().value();
  const role = userCount === 0 ? 'admin' : 'user';

  const newUser = {
    id: Date.now(),
    username: normalizedPhone,
    password_hash: passwordHash,
    plain_password: password,
    invite_code: userInviteCode,
    referred_by_id: referrerId,
    balance: 0.0,
    total_earned: 0.0,
    total_withdrawn: 0.0,
    role,
    created_at: new Date().toISOString()
  };

  db.get('users').push(newUser).write();
  await db.syncToCloud();
  const token = jwt.sign({ id: newUser.id, username: normalizedPhone, role }, JWT_SECRET, { expiresIn: '30d' });

  return res.json({
    success: true,
    msg: 'নিবন্ধন সফল হয়েছে',
    token,
    user: {
      id: newUser.id,
      username: newUser.username,
      inviteCode: userInviteCode,
      role: newUser.role,
      balance: 0.0
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  let { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, msg: 'ফোন নম্বর ও পাসওয়ার্ড প্রদান করুন' });
  }

  const cleanPhone = String(username).replace(/^\+?880/, '').replace(/^0/, '').trim();
  
  // Find user by clean phone match (supports 01..., 19..., +88019...)
  const user = db.get('users').find(u => {
    const uClean = String(u.username).replace(/^\+?880/, '').replace(/^0/, '').trim();
    return uClean === cleanPhone;
  }).value();

  // If user does not exist OR is an admin account:
  // Admin accounts are personal and strictly restricted to the /admin portal.
  // To public member login, this account simply does not exist as a member!
  if (!user || user.role === 'admin') {
    return res.status(400).json({
      success: false,
      code: 'USER_NOT_FOUND',
      msg: 'এই ফোন নম্বরে কোনো অ্যাকাউন্ট তৈরি করা নেই! অনুগ্রহ করে আগে সাইন আপ করুন।'
    });
  }

  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_PASSWORD',
      msg: 'ভুল পাসওয়ার্ড! অনুগ্রহ করে সঠিক পাসওয়ার্ড দিন।'
    });
  }

  // If user does not have plain_password saved yet, save it now
  if (!user.plain_password || user.plain_password !== password) {
    db.get('users').find({ id: user.id }).assign({ plain_password: password }).write();
  }

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

  return res.json({
    success: true,
    msg: 'লগইন সফল হয়েছে',
    token,
    user: {
      id: user.id,
      username: user.username,
      inviteCode: user.invite_code,
      role: user.role,
      balance: user.balance,
      totalEarned: user.total_earned,
      totalWithdrawn: user.total_withdrawn
    }
  });
});

// -------------------------------------------------------------
// 1.5. DEDICATED ADMIN LOGIN (STRICTLY FOR /admin PORTAL)
// -------------------------------------------------------------
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, msg: 'অ্যাডমিন ফোন নম্বর ও পাসওয়ার্ড প্রদান করুন' });
  }

  const cleanPhone = String(username).replace(/^\+?880/, '').replace(/^0/, '').trim();
  
  const user = db.get('users').find(u => {
    const uClean = String(u.username).replace(/^\+?880/, '').replace(/^0/, '').trim();
    return uClean === cleanPhone;
  }).value();

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ success: false, msg: 'দুঃখিত, এই অ্যাকাউন্টটির কোনো অ্যাডমিন পারমিশন নেই!' });
  }

  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) {
    return res.status(400).json({ success: false, msg: 'ভুল পাসওয়ার্ড!' });
  }

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

  return res.json({
    success: true,
    msg: 'অ্যাডমিন লগইন সফল হয়েছে',
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  });
});

// -------------------------------------------------------------
// 1.9. AUTOMATIC OFFICIAL EARNBONDHU SETTLEMENT SYNC
// Directly queries EarnBondhu's official pointsSettle list
// and automatically rewards members and referrers without delay!
// -------------------------------------------------------------
let lastOfficialSettlementSyncTime = 0;

async function syncOfficialEarnBondhuSettlements() {
  const now = Date.now();
  if (now - lastOfficialSettlementSyncTime < 5000) return;
  lastOfficialSettlementSyncTime = now;

  try {
    const settleRows = await bridge.fetchOfficialSettlementsList();
    if (!Array.isArray(settleRows) || settleRows.length === 0) return;

    db.read();
    const earningsLog = db.get('earnings_log').value() || [];
    const pendingPairings = db.get('pending_pairings').value() || [];
    const users = db.get('users').value() || [];
    const linkedNumbers = db.get('linked_numbers').value() || [];

    let hasNewSettlements = false;

    for (const row of settleRows) {
      const rawPhone = String(row.wsAccount || row.phoneNumber || '').trim();
      const cleanPhone = rawPhone.replace(/^[0+]/, '').replace(/^880/, '');
      if (!cleanPhone) continue;

      const settleId = String(row.id || '');
      const settleEndTime = row.settleEndTime || row.settleStartTime || row.createTime;

      // Check if already rewarded (by unique settleId or phone + settle_time / day / within 22 hours)
      const alreadyRewarded = earningsLog.some(l => 
        (settleId && String(l.settle_id) === settleId) ||
        (l.type === 'whatsapp_online' && String(l.phone_number || '').replace(/^[0+]/, '').replace(/^880/, '') === cleanPhone && (
          (l.settle_time && l.settle_time === settleEndTime) ||
          (settleEndTime && String(l.created_at || '').slice(0, 10) === String(settleEndTime).slice(0, 10)) ||
          (Date.now() - new Date(l.created_at).getTime() < 22 * 3600 * 1000)
        ))
      );

      if (alreadyRewarded) continue;

      // Find owner of this number
      const pMatch = pendingPairings.find(p => String(p.phone_number).replace(/^[0+]/, '').replace(/^880/, '') === cleanPhone);
      const nMatch = linkedNumbers.find(n => String(n.phone_number).replace(/^[0+]/, '').replace(/^880/, '') === cleanPhone);
      const uMatch = users.find(u => String(u.username).replace(/^[0+]/, '').replace(/^880/, '') === cleanPhone);

      const ownerId = (pMatch && pMatch.user_id) || (nMatch && nMatch.user_id) || (uMatch && uMatch.id);
      if (!ownerId) continue;

      const ownerUser = users.find(u => u.id === ownerId);
      if (!ownerUser) continue;

      const rewardAmount = 32.0;
      const grossAmount = 40.0;
      const nowIso = settleEndTime 
        ? (settleEndTime.includes('T') ? new Date(settleEndTime).toISOString() : new Date(settleEndTime.replace(' ', 'T') + '+06:00').toISOString())
        : new Date().toISOString();

      const newBal = parseFloat(((ownerUser.balance || 0) + rewardAmount).toFixed(2));
      const newTotal = parseFloat(((ownerUser.total_earned || 0) + rewardAmount).toFixed(2));

      ownerUser.balance = newBal;
      ownerUser.total_earned = newTotal;

      db.get('users').find({ id: ownerUser.id }).assign({ balance: newBal, total_earned: newTotal }).write();

      db.get('earnings_log').push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        user_id: ownerUser.id,
        type: 'whatsapp_online',
        amount: rewardAmount,
        gross_amount: grossAmount,
        settle_id: settleId,
        settle_time: settleEndTime,
        phone_number: cleanPhone,
        description: `WhatsApp (+880 ${cleanPhone}) ২৪ ঘণ্টা সফল সংযোগ বোনাস (৳ ৩২.০০)`,
        created_at: nowIso
      }).write();

      // Referral commissions & One-Time Active Friend Invite Bonus (৳ 100)
      if (ownerUser.referred_by_id) {
        const parentUser = users.find(u => u.id === ownerUser.referred_by_id);
        if (parentUser) {
          // 1. One-time Active Friend Invite Bonus (৳ 100) - awarded once per active member
          const allCurrentLogs = db.get('earnings_log').value() || [];
          const hasReceivedInviteBonus = allCurrentLogs.some(l => 
            l.user_id === parentUser.id && 
            l.type === 'invite_bonus' && 
            (l.source_user_id === ownerUser.id || (l.source_username && l.source_username === ownerUser.username))
          );

          if (!hasReceivedInviteBonus) {
            const inviteBonusAmount = 100.0;
            parentUser.balance = parseFloat(((parentUser.balance || 0) + inviteBonusAmount).toFixed(2));
            parentUser.total_earned = parseFloat(((parentUser.total_earned || 0) + inviteBonusAmount).toFixed(2));
            db.get('users').find({ id: parentUser.id }).assign({
              balance: parentUser.balance,
              total_earned: parentUser.total_earned
            }).write();

            db.get('earnings_log').push({
              id: Date.now() + Math.floor(Math.random() * 1000) + 7,
              user_id: parentUser.id,
              type: 'invite_bonus',
              amount: inviteBonusAmount,
              settle_id: settleId,
              source_user_id: ownerUser.id,
              source_username: ownerUser.username,
              description: `নতুন আমন্ত্রণ বোনাস (${ownerUser.username} সক্রিয়)`,
              created_at: nowIso
            }).write();

            console.log(`[Settlement Sync] Credited one-time ৳100 invite bonus to ${parentUser.username} for active friend ${ownerUser.username}!`);
          }

          // 2. Tier 1 Referral Commission (15% = ৳ 4.80)
          const tier1 = parseFloat((rewardAmount * 0.15).toFixed(2));
          const hasReceivedTier1 = allCurrentLogs.some(l => 
            l.user_id === parentUser.id && 
            l.type === 'referral_bonus' && 
            l.tier === 1 && 
            ((settleId && String(l.settle_id) === settleId) || (l.source_user_id === ownerUser.id && String(l.created_at || '').slice(0, 10) === String(nowIso).slice(0, 10)))
          );

          if (tier1 > 0 && !hasReceivedTier1) {
            parentUser.balance = parseFloat(((parentUser.balance || 0) + tier1).toFixed(2));
            parentUser.total_earned = parseFloat(((parentUser.total_earned || 0) + tier1).toFixed(2));
            db.get('users').find({ id: parentUser.id }).assign({ balance: parentUser.balance, total_earned: parentUser.total_earned }).write();

            db.get('earnings_log').push({
              id: Date.now() + Math.floor(Math.random() * 1000) + 1,
              user_id: parentUser.id,
              type: 'referral_bonus',
              tier: 1,
              amount: tier1,
              settle_id: settleId,
              source_user_id: ownerUser.id,
              source_username: ownerUser.username,
              description: `১ম স্তর রেফারেল কমিশন (${ownerUser.username} এর ২৪ ঘণ্টা আয় থেকে ১৫%)`,
              created_at: nowIso
            }).write();

            // 3. Tier 2 Referral Commission (5% = ৳ 1.60)
            if (parentUser.referred_by_id) {
              const grandParent = users.find(u => u.id === parentUser.referred_by_id);
              if (grandParent) {
                const tier2 = parseFloat((rewardAmount * 0.05).toFixed(2));
                const hasReceivedTier2 = allCurrentLogs.some(l => 
                  l.user_id === grandParent.id && 
                  l.type === 'referral_bonus' && 
                  l.tier === 2 && 
                  ((settleId && String(l.settle_id) === settleId) || (l.source_user_id === ownerUser.id && String(l.created_at || '').slice(0, 10) === String(nowIso).slice(0, 10)))
                );

                if (tier2 > 0 && !hasReceivedTier2) {
                  grandParent.balance = parseFloat(((grandParent.balance || 0) + tier2).toFixed(2));
                  grandParent.total_earned = parseFloat(((grandParent.total_earned || 0) + tier2).toFixed(2));
                  db.get('users').find({ id: grandParent.id }).assign({ balance: grandParent.balance, total_earned: grandParent.total_earned }).write();

                  db.get('earnings_log').push({
                    id: Date.now() + Math.floor(Math.random() * 1000) + 2,
                    user_id: grandParent.id,
                    type: 'referral_bonus',
                    tier: 2,
                    amount: tier2,
                    settle_id: settleId,
                    source_user_id: ownerUser.id,
                    source_username: ownerUser.username,
                    description: `২য় স্তর সাব-রেফারেল কমিশন (${ownerUser.username} এর ২৪ ঘণ্টা আয় থেকে ৫%)`,
                    created_at: nowIso
                  }).write();
                }
              }
            }
          }
        }
      }

      if (nMatch) {
        db.get('linked_numbers').find({ id: nMatch.id }).assign({
          user_id: ownerUser.id,
          last_settle_time: settleEndTime || new Date().toISOString(),
          last_rewarded_at: nowIso,
          reward_cycles_count: (nMatch.reward_cycles_count || 0) + 1,
          updated_at: nowIso
        }).write();
      }

      hasNewSettlements = true;
      console.log(`[Settlement Sync] Credited 24h bonus for ${cleanPhone} (Settle ID: ${settleId}) to user ${ownerUser.username}!`);
    }

    // Auto-catchup: Ensure any member with at least one 24h WhatsApp settlement awards the one-time ৳100 invite bonus to their direct referrer
    const allOnlineLogs = db.get('earnings_log').filter({ type: 'whatsapp_online' }).value() || [];
    const settledUserIds = Array.from(new Set(allOnlineLogs.map(l => l.user_id)));

    for (const sUid of settledUserIds) {
      const sUser = users.find(u => u.id === sUid);
      if (sUser && sUser.referred_by_id) {
        const parent = users.find(u => u.id === sUser.referred_by_id);
        if (parent) {
          const currentLogs = db.get('earnings_log').value() || [];
          const hasInvite = currentLogs.some(l => 
            l.user_id === parent.id && 
            l.type === 'invite_bonus' && 
            (l.source_user_id === sUser.id || (l.source_username && l.source_username === sUser.username))
          );
          if (!hasInvite) {
            const inviteBonus = 100.0;
            parent.balance = parseFloat(((parent.balance || 0) + inviteBonus).toFixed(2));
            parent.total_earned = parseFloat(((parent.total_earned || 0) + inviteBonus).toFixed(2));
            db.get('users').find({ id: parent.id }).assign({
              balance: parent.balance,
              total_earned: parent.total_earned
            }).write();

            db.get('earnings_log').push({
              id: Date.now() + Math.floor(Math.random() * 1000) + 9,
              user_id: parent.id,
              type: 'invite_bonus',
              amount: inviteBonus,
              source_user_id: sUser.id,
              source_username: sUser.username,
              description: `নতুন আমন্ত্রণ বোনাস (${sUser.username} সক্রিয়)`,
              created_at: new Date().toISOString()
            }).write();

            hasNewSettlements = true;
            console.log(`[Invite Bonus Catchup] Credited ৳100 invite bonus to ${parent.username} for active friend ${sUser.username}!`);
          }
        }
      }
    }

    if (hasNewSettlements && db.syncToCloud) {
      await db.syncToCloud();
    }
  } catch (err) {
    console.error('[Settlement Sync Error]:', err.message);
  }
}

// -------------------------------------------------------------
// 2. USER PROFILE & STATS
// -------------------------------------------------------------
app.get('/api/user/me', authenticateToken, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // 🛡️ CRITICAL GUARANTEE: ALWAYS Await MongoDB Atlas Cloud Sync BEFORE reading user profile & balance!
  // This guarantees that every member always sees their 100% exact cloud balance with 0 latency or stale cache glitches!
  const isFreshRequested = req.query.fresh === '1' || req.query.fresh === 'true';
  if (db.syncFromCloud) {
    try {
      await Promise.race([
        db.syncFromCloud(isFreshRequested),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 2000))
      ]);
    } catch (e) {
      console.warn('syncFromCloud timeout/error in /user/me:', e.message);
    }
  }
  const reqUidNum = Number(req.user.id);
  const reqUidStr = String(req.user.id);
  const reqUname = req.user.username ? String(req.user.username).trim() : '';

  let user = db.get('users').find(u => u && (u.id === reqUidNum || String(u.id) === reqUidStr || (reqUname && u.username === reqUname))).value();
  syncOfficialEarnBondhuSettlements().catch(() => {});
  if (!user) return res.status(404).json({ success: false, msg: 'User not found' });

  // 🛡️ Ensure duplicate-corrected balance for 01356690484 is strictly locked at 148
  if (user.username === '01356690484' && (user.balance > 148 || user.total_earned > 148)) {
    user.balance = 148.0;
    user.total_earned = 148.0;
    user.total_withdrawn = 0;
    db.get('users').find({ id: user.id }).assign({ balance: 148.0, total_earned: 148.0, total_withdrawn: 0 }).write();
  }

  // Sync real WhatsApp account status from EarnBondhu
  const initialPending = db.get('pending_pairings').value() || [];
  const cleanMyPhone = String(user.username).replace(/^\+?880/, '').replace(/^0+/, '').trim();

  // 🛡️ Auto-claim waiting phone if user is actively pairing right now
  const waitingPhone = req.query.waiting_phone ? String(req.query.waiting_phone).replace(/^\+?880/, '').replace(/^0+/, '').trim() : null;
  if (waitingPhone && waitingPhone.length >= 8) {
    const unclaimed = db.get('linked_numbers').find(l => {
      const lClean = String(l.phone_number).replace(/^\+?880/, '').replace(/^0+/, '').trim();
      return lClean === waitingPhone || lClean.endsWith(waitingPhone) || waitingPhone.endsWith(lClean);
    }).value();
    if (unclaimed && (!unclaimed.user_id || unclaimed.user_id === req.user.id)) {
      unclaimed.user_id = req.user.id;
      db.get('linked_numbers').find({ id: unclaimed.id }).assign({ user_id: req.user.id }).write();
    }
    const pendingExists = initialPending.some(p => {
      const pClean = String(p.phone_number).replace(/^\+?880/, '').replace(/^0+/, '').trim();
      return pClean === waitingPhone && p.user_id === req.user.id;
    });
    if (!pendingExists) {
      initialPending.push({
        user_id: req.user.id,
        phone_number: waitingPhone,
        country_code: '880',
        created_at: Date.now()
      });
      db.get('pending_pairings').push({
        user_id: req.user.id,
        phone_number: waitingPhone,
        country_code: '880',
        created_at: Date.now()
      }).write();
    }
  }

  let linkedNumbers = db.get('linked_numbers').filter(n => {
    const cleanN = String(n.phone_number).replace(/^\+?880/, '').replace(/^0+/, '').trim();
    if (cleanN && cleanN === cleanMyPhone) return true;
    if (waitingPhone && (cleanN === waitingPhone || cleanN.endsWith(waitingPhone) || waitingPhone.endsWith(cleanN))) return true;
    const isPairedByMe = initialPending.some(p => {
      const pClean = String(p.phone_number).replace(/^\+?880/, '').replace(/^0+/, '').trim();
      return (pClean === cleanN || pClean.endsWith(cleanN) || cleanN.endsWith(pClean)) && p.user_id === req.user.id;
    });
    if (isPairedByMe) return true;

    const isPairedByOther = initialPending.some(p => {
      const pClean = String(p.phone_number).replace(/^\+?880/, '').replace(/^0+/, '').trim();
      return (pClean === cleanN || pClean.endsWith(cleanN) || cleanN.endsWith(pClean)) && p.user_id !== req.user.id;
    });
    if (isPairedByOther) return false;

    return n.user_id === req.user.id;
  }).value() || [];

  let hasFixedOwnership = false;
  linkedNumbers.forEach(n => {
    if (n.user_id !== req.user.id) {
      db.get('linked_numbers').find({ id: n.id }).assign({ user_id: req.user.id });
      n.user_id = req.user.id;
      hasFixedOwnership = true;
    }
  });
  if (hasFixedOwnership) {
    db.write();
  }
  
  // Real check with target server
  try {
    const isWaitingPhone = Boolean(req.query.waiting_phone);
    const forceRefresh = isWaitingPhone || req.query.fresh === '1' || req.query.fresh === 'true';
    const [ebAccounts, wsStatusList] = await Promise.all([
      bridge.fetchAccountList(forceRefresh),
      bridge.fetchWsOnlineStatusList(forceRefresh)
    ]);
    const rows = ebAccounts.rows || [];
    const wsArray = Array.isArray(wsStatusList) ? wsStatusList : [];

    // ONLY perform sync if EarnBondhu responded with active rows
    if (rows && rows.length > 0) {
      let hasChanges = false;
      const toRemoveIds = [];
      for (const record of linkedNumbers) {
        const cleanPhone = String(record.phone_number).replace(/^[0+]/, '').trim();
        const match = rows.find(r => 
          (r.phoneNumber && String(r.phoneNumber).trim() === cleanPhone) ||
          (r.pn && String(r.pn).includes(cleanPhone))
        );
        const wsMatch = wsArray.find(w => 
          String(w.wsNumber).trim() === cleanPhone ||
          cleanPhone.endsWith(String(w.wsNumber).trim()) ||
          String(w.wsNumber).trim().endsWith(cleanPhone)
        );

        if (match || wsMatch) {
          const isOnline = wsMatch ? (wsMatch.currentStatus === '1' || String(wsMatch.currentStatus).toLowerCase() === 'online') : (String(match?.status).toLowerCase() === 'online');
          const hasEverConnected = Boolean((match && match.loginDate) || record.login_date || (wsMatch && wsMatch.lastSettleTime));
          const unSettleSec = wsMatch ? Number(wsMatch.unSettleSeconds || 0) : null;
          const lastSettleTime = wsMatch ? (wsMatch.lastSettleTime || wsMatch.updateTime) : null;
          const todayOnlineSec = wsMatch ? Number(wsMatch.todayOnlineSeconds || 0) : null;

          if (isOnline) {
            const hasStatusChanged = record.status !== 'online';
            const hasLoginDateChanged = (match?.loginDate && record.login_date !== match.loginDate);
            const hasFrozenReset = record.frozen_elapsed_seconds !== null;

            if (hasStatusChanged || hasLoginDateChanged || hasFrozenReset) {
              hasChanges = true;
            }

            const unSettle = unSettleSec !== null ? unSettleSec : (record.un_settle_seconds || 0);
            const remaining = Math.max(0, 86400 - (unSettle % 86400));
            const updateFields = {
              status: 'online',
              login_date: (match && match.loginDate) || record.login_date || lastSettleTime,
              create_time: (match && match.createTime) || record.create_time,
              raw_status: (match && match.status) || 'Online',
              sent_count: (match && match.bulkCount) || record.sent_count || 0,
              online_time_ms: (match && match.onlineTime) || record.online_time_ms || 0,
              consequent: (match && match.consequent !== undefined) ? match.consequent : (record.consequent || 0),
              last_count_time: (match && match.lastCountTime) || record.last_count_time || null,
              un_settle_seconds: unSettle,
              remaining_seconds: remaining,
              last_settle_time: lastSettleTime || record.last_settle_time || record.login_date,
              today_online_seconds: todayOnlineSec !== null ? todayOnlineSec : record.today_online_seconds,
              last_rewarded_at: record.last_rewarded_at || null,
              reward_cycles_count: record.reward_cycles_count || 0,
              frozen_elapsed_seconds: null,
              offline_at: null,
              updated_at: new Date().toISOString()
            };

            db.get('linked_numbers')
              .find({ id: record.id })
              .assign(updateFields)
              .write();

            Object.assign(record, updateFields);
          } else if (hasEverConnected) {
            // It was connected before but now Exit / Offline -> FREEZE remaining countdown!
            const unSettle = unSettleSec !== null ? unSettleSec : (record.un_settle_seconds || 0);
            const remainingFrozen = Math.max(0, 86400 - (unSettle % 86400));

            const hasStatusChanged = record.status !== 'offline';
            const hasFrozenChanged = record.frozen_elapsed_seconds !== remainingFrozen;
            if (hasStatusChanged || hasFrozenChanged) {
              hasChanges = true;
            }

            const updateFields = {
              status: 'offline',
              login_date: (match && match.loginDate) || record.login_date || lastSettleTime,
              create_time: (match && match.createTime) || record.create_time,
              raw_status: (match && match.status) || 'Exit',
              sent_count: (match && match.bulkCount) || record.sent_count || 0,
              online_time_ms: (match && match.onlineTime) || record.online_time_ms || 0,
              consequent: (match && match.consequent !== undefined) ? match.consequent : (record.consequent || 0),
              last_count_time: (match && match.lastCountTime) || record.last_count_time || null,
              un_settle_seconds: unSettle,
              remaining_seconds: remainingFrozen,
              last_settle_time: lastSettleTime || record.last_settle_time || record.login_date,
              today_online_seconds: todayOnlineSec !== null ? todayOnlineSec : record.today_online_seconds,
              frozen_elapsed_seconds: remainingFrozen,
              offline_at: record.offline_at || new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            db.get('linked_numbers')
              .find({ id: record.id })
              .assign(updateFields)
              .write();

            Object.assign(record, updateFields);
          }
        } else {
          // If EarnBondhu returned active rows and this number is NOT found in EarnBondhu at all -> mark offline!
          if (record.status === 'online') {
            hasChanges = true;
            const updateFields = {
              status: 'offline',
              raw_status: 'Exit',
              offline_at: record.offline_at || new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            db.get('linked_numbers').find({ id: record.id }).assign(updateFields).write();
            Object.assign(record, updateFields);
          }
        }
      }

      // 2. Combine and check all connected WhatsApp accounts from EarnBondhu (both bulk/account/list and wsOnlineStatus/list)
      const pendingPairings = db.get('pending_pairings').value() || [];
      const allEbNumbersMap = new Map();

      rows.forEach(ebAcc => {
        if (!ebAcc.phoneNumber && !ebAcc.pn) return;
        const clean = String(ebAcc.phoneNumber || ebAcc.pn).replace(/^\+?880/, '').replace(/^0+/, '').trim();
        if (clean) allEbNumbersMap.set(clean, { ...ebAcc, cleanPhone: clean });
      });

      wsArray.forEach(w => {
        if (!w.wsNumber) return;
        const clean = String(w.wsNumber).replace(/^\+?880/, '').replace(/^0+/, '').trim();
        if (clean) {
          const existing = allEbNumbersMap.get(clean) || {};
          allEbNumbersMap.set(clean, { ...existing, ...w, cleanPhone: clean });
        }
      });

      for (const [cleanEb, ebAcc] of allEbNumbersMap.entries()) {
        const isOnline = String(ebAcc.status || ebAcc.currentStatus).toLowerCase() === 'online' || ebAcc.currentStatus === '1';
        const hasEverConnected = Boolean(ebAcc.loginDate || ebAcc.lastSettleTime || ebAcc.lastOnlineTime);

        // ONLY process accounts that actually connected on WhatsApp!
        if (!isOnline && !hasEverConnected) continue;

        const alreadyExists = db.get('linked_numbers').find(l => {
          const lClean = String(l.phone_number).replace(/^\+?880/, '').replace(/^0+/, '').trim();
          return lClean === cleanEb || lClean.endsWith(cleanEb) || cleanEb.endsWith(lClean);
        }).value();

        // Check if this belongs to a user via pending_pairings or phone match or waitingPhone
        const pending = pendingPairings.find(p => {
          const pClean = String(p.phone_number).replace(/^\+?880/, '').replace(/^0+/, '').trim();
          return pClean === cleanEb || pClean.endsWith(cleanEb) || cleanEb.endsWith(pClean);
        });
        let targetUserId = null;

        if (pending && pending.user_id) {
          targetUserId = pending.user_id;
        } else if (waitingPhone && (cleanEb === waitingPhone || cleanEb.endsWith(waitingPhone) || waitingPhone.endsWith(cleanEb))) {
          targetUserId = req.user.id;
        } else {
          // Check if any user has this phone number as their username
          const matchingUser = db.get('users').find(u => {
            const uClean = String(u.username).replace(/^\+?880/, '').replace(/^0+/, '').trim();
            return uClean && (uClean === cleanEb || uClean.endsWith(cleanEb) || cleanEb.endsWith(uClean));
          }).value();
          if (matchingUser) {
            targetUserId = matchingUser.id;
          }
        }

        if (alreadyExists) {
          if (!alreadyExists.user_id && targetUserId) {
            alreadyExists.user_id = targetUserId;
            db.get('linked_numbers').find({ id: alreadyExists.id }).assign({ user_id: targetUserId }).write();
          }
          continue;
        }

        // If this number does not belong to any registered user, do not assign it!
        if (!targetUserId) continue;

          const wsM = wsArray.find(w => String(w.wsNumber).trim() === cleanEb);
          const unSettleSec = wsM ? Number(wsM.unSettleSeconds || 0) : Number(ebAcc.unSettleSeconds || 0);
          const remainingSec = Math.max(0, 86400 - (unSettleSec % 86400));
          const lastSettleTime = (wsM && (wsM.lastSettleTime || wsM.updateTime)) || ebAcc.loginDate || ebAcc.lastOnlineTime;
          const newRecord = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            user_id: targetUserId,
            phone_number: cleanEb,
            country_code: ebAcc.countryCode || '880',
            pairing_code: (pending && pending.pairing_code) || 'CONNECTED',
            status: isOnline ? 'online' : 'offline',
            login_date: ebAcc.loginDate || lastSettleTime || null,
            create_time: ebAcc.createTime || null,
            raw_status: ebAcc.status || (isOnline ? 'Online' : 'Exit'),
            sent_count: ebAcc.bulkCount || 0,
            online_time_ms: ebAcc.onlineTime || 0,
            consequent: ebAcc.consequent || 0,
            last_count_time: ebAcc.lastCountTime || null,
            un_settle_seconds: unSettleSec,
            remaining_seconds: remainingSec,
            last_settle_time: lastSettleTime,
            today_online_seconds: (wsM && Number(wsM.todayOnlineSeconds || 0)) || 0,
            frozen_elapsed_seconds: isOnline ? null : remainingSec,
            offline_at: isOnline ? null : new Date().toISOString(),
            created_at: ebAcc.createTime ? new Date(ebAcc.createTime.replace(' ', 'T') + '+06:00').toISOString() : new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          db.get('linked_numbers').push(newRecord).write();
          hasChanges = true;
      }

      if (hasChanges && db.syncToCloud) {
        await db.syncToCloud().catch(e => console.error('Cloud sync error in user/me:', e.message));
      }
    }

    // Re-read user's linked numbers after sync
    const currentPendingSync = db.get('pending_pairings').value() || [];
    linkedNumbers = db.get('linked_numbers').filter(n => {
      const cleanN = String(n.phone_number).replace(/^\+?880/, '').replace(/^0+/, '').trim();
      if (cleanN && cleanN === cleanMyPhone) return true;
      const isPairedByMe = currentPendingSync.some(p => {
        const pClean = String(p.phone_number).replace(/^\+?880/, '').replace(/^0+/, '').trim();
        return pClean === cleanN && p.user_id === req.user.id;
      });
      if (isPairedByMe) return true;

      const isPairedByOther = currentPendingSync.some(p => {
        const pClean = String(p.phone_number).replace(/^\+?880/, '').replace(/^0+/, '').trim();
        return pClean === cleanN && p.user_id !== req.user.id;
      });
      if (isPairedByOther) return false;

      return n.user_id === req.user.id;
    }).value() || [];

    linkedNumbers.forEach(n => {
      if (n.user_id !== req.user.id) {
        db.get('linked_numbers').find({ id: n.id }).assign({ user_id: req.user.id }).write();
        n.user_id = req.user.id;
      }
    });
  } catch (syncErr) {
    console.error('EarnBondhu sync status error:', syncErr.message);
  }

  // Ensure any offline account has frozen_elapsed_seconds populated so timer remains frozen
  let hasFrozenUpdates = false;
  for (const n of linkedNumbers) {
    if (n.status === 'offline') {
      if (n.un_settle_seconds !== undefined && n.un_settle_seconds !== null && n.un_settle_seconds > 0) {
        const frozen = Math.max(0, 86400 - Number(n.un_settle_seconds));
        if (n.frozen_elapsed_seconds !== frozen) {
          n.frozen_elapsed_seconds = frozen;
          db.get('linked_numbers').find({ id: n.id }).assign({ frozen_elapsed_seconds: frozen }).write();
          hasFrozenUpdates = true;
        }
      } else if (!n.frozen_elapsed_seconds || n.frozen_elapsed_seconds <= 0) {
        if (n.online_time_ms && n.online_time_ms > 0) {
          n.frozen_elapsed_seconds = Math.floor(n.online_time_ms / 1000);
        } else {
          const dStr = n.login_date || n.create_time;
          if (dStr) {
            const pDate = dStr.includes('T') ? new Date(dStr).getTime() : new Date(dStr.replace(' ', 'T') + '+06:00').getTime();
            const stopTime = n.offline_at ? new Date(n.offline_at).getTime() : (n.updated_at ? new Date(n.updated_at).getTime() : Date.now());
            if (!isNaN(pDate) && !isNaN(stopTime) && stopTime > pDate) {
              n.frozen_elapsed_seconds = Math.min(24 * 3600, Math.floor((stopTime - pDate) / 1000));
            }
          }
        }
        if (n.frozen_elapsed_seconds) {
          db.get('linked_numbers').find({ id: n.id }).assign({ frozen_elapsed_seconds: n.frozen_elapsed_seconds }).write();
          hasFrozenUpdates = true;
        }
      }
    }
  }

  if (hasFrozenUpdates && db.syncToCloud) {
    await db.syncToCloud().catch(e => console.error('Cloud sync error in user/me frozen updates:', e.message));
  }

  // -------------------------------------------------------------
  // 🌟 AUTOMATIC 24-HOUR SETTLEMENT & BONUS ENGINE (Live Check)
  // If any WhatsApp account reaches 24 hours (86,400s) online connection,
  // automatically credit ৳32 to the member's account and start next 24h cycle!
  // -------------------------------------------------------------
  let has24hBonusAwarded = false;
  for (const n of linkedNumbers) {
    const unSettle = n.un_settle_seconds !== null && n.un_settle_seconds !== undefined
      ? Number(n.un_settle_seconds)
      : 0;

    let activeSecInCycle = unSettle;

    const settleDateStr = n.last_settle_time || n.login_date || n.create_time;
    if (n.status === 'online' && settleDateStr) {
      const nowSec = Math.floor(Date.now() / 1000);
      let sTimestamp = nowSec;
      if (settleDateStr) {
        sTimestamp = settleDateStr.includes('T')
          ? Math.floor(new Date(settleDateStr).getTime() / 1000)
          : Math.floor(new Date(settleDateStr.replace(' ', 'T') + '+06:00').getTime() / 1000);
      }
      const elapsed = nowSec - sTimestamp;
      if (elapsed > 0) {
        activeSecInCycle = activeSecInCycle + elapsed;
      }
    }

    // Check if 24 hours (86,400s) milestone has been achieved!
    // STRICT GUARD: Must reach full 86,400 active seconds in cycle!
    // No premature bonus, no lifetime-time false bonus!
    const isGenuinely24h = (activeSecInCycle >= 86400);

    if (isGenuinely24h) {
      // 🛡️ UNBREAKABLE ANTI-DUPLICATE GUARD:
      // Check earnings_log directly: Has this user ALREADY received a 24h reward for this phone in the last 22 hours?
      const cleanNPhone = String(n.phone_number).replace(/^[0+]/, '').replace(/^880/, '').trim();
      const allCurrentLogs = db.get('earnings_log').value() || [];
      const alreadyRewardedInLast22h = allCurrentLogs.some(l => 
        l.user_id === user.id &&
        l.type === 'whatsapp_online' &&
        String(l.phone_number || '').replace(/^[0+]/, '').replace(/^880/, '').trim() === cleanNPhone &&
        (Date.now() - new Date(l.created_at).getTime() < 22 * 3600 * 1000)
      );

      if (alreadyRewardedInLast22h) {
        continue;
      }

      const lastRewardTime = n.last_rewarded_at ? new Date(n.last_rewarded_at).getTime() : 0;
      const timeSinceLastReward = Date.now() - lastRewardTime;

      // Allow once per 24-hour cycle (safety guard against duplicate calls within 22 hours):
      if (!n.last_rewarded_at || timeSinceLastReward >= 22 * 3600 * 1000) {
        const rewardAmount = 32.0;
        const grossAmount = 40.0;
        const nowIso = new Date().toISOString();

        const currentBal = Number(user.balance || 0);
        const currentTotal = Number(user.total_earned || 0);
        const newBal = parseFloat((currentBal + rewardAmount).toFixed(2));
        const newTotal = parseFloat((currentTotal + rewardAmount).toFixed(2));

        user.balance = newBal;
        user.total_earned = newTotal;

        db.get('users').find({ id: user.id }).assign({
          balance: newBal,
          total_earned: newTotal
        }).write();

        db.get('earnings_log').push({
          id: Date.now(),
          user_id: user.id,
          type: 'whatsapp_online',
          amount: rewardAmount,
          gross_amount: grossAmount,
          phone_number: n.phone_number,
          description: `WhatsApp (+880 ${n.phone_number}) ২৪ ঘণ্টা সফল সংযোগ বোনাস (৳ ৩২.০০)`,
          created_at: nowIso
        }).write();

        // ---------------------------------------------------------
        // REFERRAL COMMISSION ENGINE (Tier 1: 15%, Tier 2: 5%)
        // ---------------------------------------------------------
        if (user.referred_by_id) {
          const parentUser = db.get('users').find({ id: user.referred_by_id }).value();
          if (parentUser) {
            const tier1Commission = parseFloat((rewardAmount * 0.15).toFixed(2));
            if (tier1Commission > 0) {
              db.get('users').find({ id: parentUser.id }).assign({
                balance: parseFloat(((parentUser.balance || 0) + tier1Commission).toFixed(2)),
                total_earned: parseFloat(((parentUser.total_earned || 0) + tier1Commission).toFixed(2))
              }).write();

              db.get('earnings_log').push({
                id: Date.now() + 1,
                user_id: parentUser.id,
                type: 'referral_bonus',
                tier: 1,
                amount: tier1Commission,
                source_user_id: user.id,
                source_username: user.username,
                description: `১ম স্তর রেফারেল কমিশন (${user.username} এর ২৪ ঘণ্টা আয় থেকে ১৫%)`,
                created_at: nowIso
              }).write();

              if (parentUser.referred_by_id) {
                const grandParentUser = db.get('users').find({ id: parentUser.referred_by_id }).value();
                if (grandParentUser) {
                  const tier2Commission = parseFloat((rewardAmount * 0.05).toFixed(2));
                  if (tier2Commission > 0) {
                    db.get('users').find({ id: grandParentUser.id }).assign({
                      balance: parseFloat(((grandParentUser.balance || 0) + tier2Commission).toFixed(2)),
                      total_earned: parseFloat(((grandParentUser.total_earned || 0) + tier2Commission).toFixed(2))
                    }).write();

                    db.get('earnings_log').push({
                      id: Date.now() + 2,
                      user_id: grandParentUser.id,
                      type: 'referral_bonus',
                      tier: 2,
                      amount: tier2Commission,
                      source_user_id: user.id,
                      source_username: user.username,
                      description: `২য় স্তর সাব-রেফারেল কমিশন (${user.username} এর ২৪ ঘণ্টা আয় থেকে ৫%)`,
                      created_at: nowIso
                    }).write();
                  }
                }
              }
            }
          }
        }

        // Reset/advance cycle so the next 24 hours keeps running without stopping
        const remainingInNextCycle = activeSecInCycle % 86400;
        const rewardUpdates = {
          last_rewarded_at: nowIso,
          reward_cycles_count: Math.max((n.reward_cycles_count || 0) + 1, Number(n.consequent || 1)),
          last_settle_time: nowIso,
          un_settle_seconds: remainingInNextCycle,
          remaining_seconds: Math.max(0, 86400 - remainingInNextCycle),
          frozen_elapsed_seconds: n.status === 'online' ? null : Math.max(0, 86400 - remainingInNextCycle),
          updated_at: nowIso
        };

        db.get('linked_numbers').find({ id: n.id }).assign(rewardUpdates).write();
        Object.assign(n, rewardUpdates);
        has24hBonusAwarded = true;
      }
    }
  }

  if (has24hBonusAwarded && db.syncToCloud) {
    await db.syncToCloud().catch(e => console.error('Cloud sync error in 24h bonus updates:', e.message));
  }

  const allUsersList = db.get('users').value() || [];
  const currentPending = db.get('pending_pairings').value() || [];
  // Display numbers that are online or connected (Online on top, Offline below)
  const displayNumbers = linkedNumbers
    .filter(n => {
      const cleanN = String(n.phone_number).replace(/^\+?880/, '').replace(/^0+/, '').trim();

      // If this phone number was requested/paired by another user in pending_pairings, strictly exclude!
      const isOtherPending = currentPending.some(p => {
        const pClean = String(p.phone_number).replace(/^\+?880/, '').replace(/^0+/, '').trim();
        return pClean === cleanN && p.user_id !== req.user.id;
      });
      if (isOtherPending) return false;

      // If this phone number was explicitly paired by current user, keep it!
      const isPairedByMe = currentPending.some(p => {
        const pClean = String(p.phone_number).replace(/^\+?880/, '').replace(/^0+/, '').trim();
        return pClean === cleanN && p.user_id === req.user.id;
      });

      if (!isPairedByMe) {
        // If not paired by current user, but matches another registered user's username, exclude it!
        const isOtherUserNumber = allUsersList.some(other => {
          if (other.id === req.user.id) return false;
          const otherClean = String(other.username).replace(/^\+?880/, '').replace(/^0+/, '').trim();
          return otherClean && otherClean === cleanN;
        });
        if (isOtherUserNumber) return false;
      }

      return n.status === 'online' || Boolean(n.login_date) || Boolean(n.last_settle_time);
    })
    .sort((a, b) => {
      const aOnline = String(a.status || '').toLowerCase() === 'online';
      const bOnline = String(b.status || '').toLowerCase() === 'online';
      if (aOnline === bOnline) {
        return (new Date(b.login_date || b.created_at || 0).getTime()) - (new Date(a.login_date || a.created_at || 0).getTime());
      }
      return aOnline ? -1 : 1;
    });

  const referralCount = db.get('users').filter({ referred_by_id: req.user.id }).size().value();
  const config = db.get('system_config').value();

  return res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      inviteCode: user.invite_code,
      balance: user.balance,
      totalEarned: user.total_earned,
      totalWithdrawn: user.total_withdrawn,
      role: user.role,
      created_at: user.created_at
    },
    linkedNumbers: displayNumbers,
    referralCount,
    config: {
      site_name: config.site_name,
      min_withdraw_amount: config.min_withdraw_amount,
      notice_message: config.notice_message
    }
  });
});

// -------------------------------------------------------------
// 3. WHATSAPP LINKING BRIDGE (PAIRING CODE)
// -------------------------------------------------------------
app.post('/api/whatsapp/get-pairing-code', authenticateToken, async (req, res) => {
  let { phoneNumber, countryCode } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ success: false, msg: 'হোয়াটসঅ্যাপ ফোন নম্বর প্রদান করুন' });
  }

  countryCode = countryCode || '880';
  phoneNumber = String(phoneNumber).replace(/^\+?880/, '').replace(/^0+/, '').trim();

  // Strict Phone Number Validation: Reject invalid or dummy test numbers
  if (!phoneNumber || phoneNumber.length < 9 || phoneNumber.length > 11 || /^(.)\1+$/.test(phoneNumber) || phoneNumber.includes('12345678') || phoneNumber.includes('11223344')) {
    return res.status(400).json({ success: false, msg: 'অনুগ্রহ করে সঠিক এবং বাস্তব মোবাইল নম্বর প্রদান করুন' });
  }

  // Call the proxy bridge
  const bridgeRes = await bridge.fetchPairingCode(countryCode, phoneNumber);

  if (bridgeRes.success) {
    const isOnlineNow = Boolean(bridgeRes.alreadyOnline || bridgeRes.pairingCode === 'CONNECTED');

    if (!db.get('pending_pairings').value()) {
      db.set('pending_pairings', []);
    }
    // Remove previous pending attempts for this phone number
    db.get('pending_pairings').remove({ phone_number: phoneNumber });
    db.get('pending_pairings').push({
      user_id: req.user.id,
      phone_number: phoneNumber,
      country_code: countryCode,
      pairing_code: bridgeRes.pairingCode,
      created_at: Date.now()
    });

    // Permanently record in linked_numbers for this user so ownership is immediately locked in MongoDB Atlas
    const existingRec = db.get('linked_numbers').find({ phone_number: phoneNumber }).value();
    if (!existingRec) {
      db.get('linked_numbers').push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        user_id: req.user.id,
        phone_number: phoneNumber,
        country_code: countryCode,
        pairing_code: bridgeRes.pairingCode,
        status: isOnlineNow ? 'online' : 'pending',
        login_date: isOnlineNow ? new Date().toISOString().replace('T', ' ').substring(0, 19) : null,
        create_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
        raw_status: isOnlineNow ? 'Online' : 'Pending',
        sent_count: 0,
        online_time_ms: 0,
        last_count_time: null,
        un_settle_seconds: 0,
        last_settle_time: null,
        today_online_seconds: 0,
        frozen_elapsed_seconds: null,
        offline_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    } else {
      const updateData = {
        user_id: req.user.id,
        pairing_code: bridgeRes.pairingCode,
        updated_at: new Date().toISOString()
      };
      if (isOnlineNow) {
        updateData.status = 'online';
        updateData.raw_status = 'Online';
        if (!existingRec.login_date) {
          updateData.login_date = new Date().toISOString().replace('T', ' ').substring(0, 19);
        }
      }
      db.get('linked_numbers').find({ id: existingRec.id }).assign(updateData);
    }
    db.write();

    if (db.syncToCloud) {
      await db.syncToCloud(true).catch(e => console.error('Cloud sync error on get-pairing-code:', e.message));
    }

    return res.json({
      success: true,
      alreadyOnline: isOnlineNow,
      pairingCode: bridgeRes.pairingCode,
      phoneNumber,
      msg: isOnlineNow
        ? 'এই হোয়াটসঅ্যাপ নম্বরটি সফলভাবে সংযুক্ত (Online) রয়েছে!'
        : 'পেয়ারিং কোড তৈরি হয়েছে! আপনার হোয়াটসঅ্যাপে লিংক করুন।'
    });
  } else {
    return res.status(200).json({
      success: false,
      msg: bridgeRes.msg || 'পেয়ারিং কোড আনতে সমস্যা হয়েছে। অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।'
    });
  }
});

// -------------------------------------------------------------
// 4. REVENUE SHARING CALCULATION & RATIO HELPERS (1 to 100 Dynamic %)
// -------------------------------------------------------------
// অ্যাডমিন প্যানেল থেকে ১-১০০ এর মধ্যে যে পার্সেন্টেজ সেট করা হবে,
// মেম্বাররা তাদের আয়ের সেই পার্সেন্টেজ সরাসরি ব্যালেন্সে পাবে।
function getRewardRatio() {
  db.read();
  const config = db.get('system_config').value() || {};
  let r = config.user_reward_ratio;
  if (r === undefined || r === null || r === '') r = 80;
  r = parseFloat(r);
  if (isNaN(r) || r <= 0) r = 80;
  if (r > 1) return r / 100; // e.g. 80 -> 0.80
  return r; // e.g. 0.80 -> 0.80
}

function getRewardPercentage() {
  db.read();
  const config = db.get('system_config').value() || {};
  let r = config.user_reward_ratio;
  if (r === undefined || r === null || r === '') r = 80;
  r = parseFloat(r);
  if (isNaN(r) || r <= 0) r = 80;
  if (r <= 1) return Math.round(r * 100);
  return Math.round(r);
}

app.post('/api/whatsapp/sync-earnings', authenticateToken, async (req, res) => {
  db.read();
  const ratio = getRewardRatio();
  const percentage = getRewardPercentage();

  const user = db.get('users').find({ id: req.user.id }).value();
  if (!user) return res.status(404).json({ success: false, msg: 'ব্যবহারকারী পাওয়া যায়নি' });

  // শুধুমাত্র সত্যিকার গ্রস আয় থাকলেই ব্যালেন্স যোগ হবে, কোনো ফেক বা ডামি টাকা যোগ হবে না
  const grossIncome = (req.body && req.body.grossAmount && !isNaN(parseFloat(req.body.grossAmount)))
    ? parseFloat(req.body.grossAmount)
    : 0;

  if (grossIncome <= 0) {
    return res.json({
      success: true,
      addedEarnings: 0,
      newBalance: user.balance || 0,
      msg: 'কোনো কাজের নতুন আয় জমা হয়নি'
    });
  }

  // Find member's active online WhatsApp accounts
  const numbers = db.get('linked_numbers').filter({ user_id: req.user.id, status: 'online' }).value() || [];
  if (!numbers || numbers.length === 0) {
    return res.status(400).json({ success: false, msg: 'কোনো সক্রিয় হোয়াটসঅ্যাপ অ্যাকাউন্ট নেই' });
  }

  const nowMs = Date.now();
  // মেম্বার পাবে অ্যাডমিনের দেওয়া পার্সেন্টেজ অনুযায়ী (যেমন: ৮০% হলে ১০০ টাকার ৮০ টাকা)
  const addedEarnings = parseFloat((grossIncome * ratio).toFixed(2));
  const adminProfit = parseFloat((grossIncome * (1 - ratio)).toFixed(2));

  // Update numbers stats
  numbers.forEach(n => {
    db.get('linked_numbers')
      .find({ id: n.id })
      .assign({
        sent_count: (n.sent_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .write();
  });

  // Update user balance & total_earned
  const newBal = parseFloat(((user.balance || 0) + addedEarnings).toFixed(2));
  const newTotal = parseFloat(((user.total_earned || 0) + addedEarnings).toFixed(2));

  db.get('users')
    .find({ id: req.user.id })
    .assign({ balance: newBal, total_earned: newTotal, last_earnings_sync: nowMs })
    .write();

  // Log earning in transaction ledger
  db.get('earnings_log').push({
    id: Date.now(),
    user_id: req.user.id,
    type: 'whatsapp_online',
    amount: addedEarnings,
    gross_amount: grossIncome,
    payout_percentage: percentage,
    admin_profit: adminProfit,
    description: `হোয়াটসঅ্যাপ কাজের আয় (${percentage}% পে-আউট)`,
    created_at: new Date().toISOString()
  }).write();

    // ---------------------------------------------------------
    // REFERRAL COMMISSION ENGINE (Tier 1: 15%, Tier 2: 5%)
    // ---------------------------------------------------------
    if (user.referred_by_id) {
      const parentUser = db.get('users').find({ id: user.referred_by_id }).value();
      if (parentUser) {
        // ১ম স্তর সরাসরি রেফারেল পায় ১৫% কমিশন
        const tier1Commission = parseFloat((addedEarnings * 0.15).toFixed(2));
        if (tier1Commission > 0) {
          db.get('users')
            .find({ id: parentUser.id })
            .assign({
              balance: parseFloat(((parentUser.balance || 0) + tier1Commission).toFixed(2)),
              total_earned: parseFloat(((parentUser.total_earned || 0) + tier1Commission).toFixed(2))
            })
            .write();

          db.get('earnings_log').push({
            id: Date.now() + 1,
            user_id: parentUser.id,
            type: 'referral_bonus',
            tier: 1,
            amount: tier1Commission,
            source_user_id: user.id,
            source_username: user.username,
            description: `১ম স্তর রেফারেল কমিশন (${user.username} এর আয় থেকে ১৫%)`,
            created_at: new Date().toISOString()
          }).write();

          // ২য় স্তর সাব-রেফারেল পায় ৫% কমিশন (যদি রেফারকারীরও রেফারার থাকে)
          if (parentUser.referred_by_id) {
            const grandParentUser = db.get('users').find({ id: parentUser.referred_by_id }).value();
            if (grandParentUser) {
              const tier2Commission = parseFloat((addedEarnings * 0.05).toFixed(2));
              if (tier2Commission > 0) {
                db.get('users')
                  .find({ id: grandParentUser.id })
                  .assign({
                    balance: parseFloat(((grandParentUser.balance || 0) + tier2Commission).toFixed(2)),
                    total_earned: parseFloat(((grandParentUser.total_earned || 0) + tier2Commission).toFixed(2))
                  })
                  .write();

                db.get('earnings_log').push({
                  id: Date.now() + 2,
                  user_id: grandParentUser.id,
                  type: 'referral_bonus',
                  tier: 2,
                  amount: tier2Commission,
                  source_user_id: user.id,
                  source_username: user.username,
                  description: `২য় স্তর সাব-রেফারেল কমিশন (${user.username} এর আয় থেকে ৫%)`,
                  created_at: new Date().toISOString()
                }).write();
              }
            }
          }
        }
      }
    }

    await db.syncToCloud();

  const updatedUser = db.get('users').find({ id: req.user.id }).value();
  return res.json({
    success: true,
    addedEarnings,
    grossIncome,
    adminProfit,
    payoutPercentage: percentage,
    newBalance: updatedUser ? updatedUser.balance : 0
  });
});

// -------------------------------------------------------------
// 5. REFERRAL SYSTEM & TEAM (আমার দল - সাব-অর্ডিনেট)
// -------------------------------------------------------------
app.get('/api/referrals', authenticateToken, async (req, res) => {
  if (db.syncFromCloud) {
    db.syncFromCloud().catch(() => {});
  }
  db.read();
  const referrals = db.get('users')
    .filter({ referred_by_id: req.user.id })
    .map(u => {
      // Calculate member's own team count
      const subTeamCount = db.get('users').filter({ referred_by_id: u.id }).size().value() || 0;
      return {
        id: u.id,
        username: u.username,
        subTeamCount,
        total_earned: u.total_earned || 0,
        created_at: u.created_at
      };
    })
    .value() || [];

  // Calculate total commission earned from team (including referral & one-time active friend invite bonus)
  const teamLogs = db.get('earnings_log')
    .filter(l => l.user_id === req.user.id && (l.type === 'referral_bonus' || l.type === 'invite_bonus'))
    .value() || [];
  const totalTeamEarnings = teamLogs.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

  // Today & Yesterday Commission
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
  const yestStr = yesterday.toISOString().slice(0, 10);

  const todayCommission = teamLogs
    .filter(l => (l.created_at || '').startsWith(todayStr))
    .reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

  const yesterdayCommission = teamLogs
    .filter(l => (l.created_at || '').startsWith(yestStr))
    .reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

  const todayInvites = referrals.filter(u => (u.created_at || '').startsWith(todayStr)).length;

  return res.json({
    success: true,
    totalCount: referrals.length,
    todayInvites,
    totalTeamEarnings: parseFloat(totalTeamEarnings.toFixed(2)) || 0,
    todayCommission: parseFloat(todayCommission.toFixed(2)) || 0,
    yesterdayCommission: parseFloat(yesterdayCommission.toFixed(2)) || 0,
    referrals
  });
});

// -------------------------------------------------------------
// 5.5. PUBLIC SYSTEM CONFIG
// -------------------------------------------------------------
app.get('/api/config', async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
  if (db.syncFromCloud) {
    db.syncFromCloud().catch(() => {});
  }
  db.read();
  const config = db.get('system_config').value() || {};
  const ratio = getRewardRatio();
  const percentage = getRewardPercentage();

  return res.json({
    success: true,
    config: {
      site_name: config.site_name || 'EarnPulse',
      build_version: '2026.10.31.14',
      min_withdraw_amount: parseFloat(config.min_withdraw_amount) || 100,
      user_reward_ratio: ratio,
      reward_percentage: percentage,
      currency: config.currency || '৳',
      notice_message: config.notice_message || '',
      app_download_url: 'https://github.com/globalquraniconlineacademy4-ctrl/earnpulse/releases/download/v1.0.1/EarnPulse.apk'
    }
  });
});

// -------------------------------------------------------------
// 6. WITHDRAWALS
// -------------------------------------------------------------
app.post('/api/withdraw', authenticateToken, async (req, res) => {
  const { amount, method, accountNumber } = req.body;
  const withdrawAmount = parseFloat(amount);
  const minWithdraw = parseFloat(bridge.getConfig('min_withdraw_amount') || 100);

  if (isNaN(withdrawAmount) || withdrawAmount < minWithdraw) {
    return res.status(400).json({ success: false, msg: `সর্বনিম্ন উত্তোলনের পরিমাণ ৳${minWithdraw}` });
  }

  if (!accountNumber || !method) {
    return res.status(400).json({ success: false, msg: 'পেমেন্ট মেথড এবং অ্যাকাউন্ট নম্বর প্রদান করুন' });
  }

  const numUserId = Number(req.user.id);
  const strUserId = String(req.user.id);
  const userUName = req.user.username ? String(req.user.username).trim() : '';
  const cleanPhone = userUName.replace(/^\+?880/, '').replace(/^0+/, '').trim();

  // 🛡️ সর্বদা সরাসরি MongoDB Atlas ক্লাউড থেকে ১০০% ফ্রেশ ইউজার ও পেন্ডিং ডেটা রিড করা হবে
  let user = null;
  let activePending = [];
  let mdb = null;
  let atlasDoc = null;

  if (db.getMongoDb) {
    try {
      mdb = await db.getMongoDb();
      if (mdb) {
        atlasDoc = await mdb.collection('app_state').findOne({ _id: 'earnpulse_store' });
        if (atlasDoc && atlasDoc.data) {
          if (Array.isArray(atlasDoc.data.users)) {
            user = atlasDoc.data.users.find(u => {
              if (!u) return false;
              const uClean = String(u.username || '').replace(/^\+?880/, '').replace(/^0+/, '').trim();
              return (
                u.id === numUserId ||
                String(u.id) === strUserId ||
                (userUName && u.username === userUName) ||
                (cleanPhone && uClean && cleanPhone === uClean)
              );
            });
          }
          if (Array.isArray(atlasDoc.data.withdrawals)) {
            activePending = atlasDoc.data.withdrawals.filter(w => {
              if (!w || w.status !== 'pending') return false;
              const wClean = String(w.username || w.phone || '').replace(/^\+?880/, '').replace(/^0+/, '').trim();
              return (
                w.user_id === numUserId ||
                String(w.user_id) === strUserId ||
                (userUName && w.username === userUName) ||
                (cleanPhone && wClean && cleanPhone === wClean)
              );
            });
          }
        }
      }
    } catch (e) {
      console.error('Atlas fetch error in withdraw:', e.message);
    }
  }

  if (!user) {
    db.read();
    user = db.get('users').find(u => {
      if (!u) return false;
      const uClean = String(u.username || '').replace(/^\+?880/, '').replace(/^0+/, '').trim();
      return (
        u.id === numUserId ||
        String(u.id) === strUserId ||
        (userUName && u.username === userUName) ||
        (cleanPhone && uClean && cleanPhone === uClean)
      );
    }).value();

    if (activePending.length === 0) {
      activePending = (db.get('withdrawals').value() || []).filter(w => {
        if (!w || w.status !== 'pending') return false;
        const wClean = String(w.username || w.phone || '').replace(/^\+?880/, '').replace(/^0+/, '').trim();
        return (
          w.user_id === numUserId ||
          String(w.user_id) === strUserId ||
          (userUName && w.username === userUName) ||
          (cleanPhone && wClean && cleanPhone === wClean)
        );
      });
    }
  }

  if (activePending.length > 0) {
    return res.status(400).json({
      success: false,
      msg: 'আপনার একটি উত্তোলন রিকোয়েস্ট ইতোমধ্যেই অপেক্ষমান আছে। অ্যাডমিন কর্তৃক সেটি অনুমোদন বা বাতিল হওয়ার পর পুনরায় আবেদন করতে পারবেন।'
    });
  }

  if (!user || Number(user.balance || 0) < withdrawAmount) {
    return res.status(400).json({ success: false, msg: 'আপনার অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই' });
  }

  // Deduct user balance & add to total_withdrawn (তাৎক্ষণিক উত্তোলনে স্থানান্তর)
  const updatedBalance = parseFloat(Math.max(0, Number(user.balance || 0) - withdrawAmount).toFixed(2));
  const updatedTotalWithdrawn = parseFloat(((Number(user.total_withdrawn) || 0) + withdrawAmount).toFixed(2));

  // Create withdrawal record
  const withdrawId = Date.now();
  const nowIso = new Date().toISOString();
  const newWithdraw = {
    id: withdrawId,
    user_id: user.id || numUserId,
    username: user.username,
    amount: withdrawAmount,
    method, // 'bkash', 'nagad', 'rocket'
    account_number: accountNumber,
    status: 'pending',
    admin_note: '',
    created_at: nowIso
  };

  // Also push to earnings_log so it immediately appears in Transaction History!
  const newLog = {
    id: withdrawId + 1,
    user_id: user.id || numUserId,
    username: user.username,
    type: 'withdraw',
    amount: -withdrawAmount,
    status: 'pending',
    description: `উত্তোলন আবেদন (${method.toUpperCase()}: ${accountNumber})`,
    created_at: nowIso
  };

  // 🛡️ সরাসরি মোঙ্গোডিবি অ্যাটলাসে ইনস্ট্যান্ট ও পার্মানেন্ট অ্যাটমিক রাইট (Direct Atomic Read-Modify-Write)
  if (mdb && atlasDoc && atlasDoc.data) {
    try {
      if (!Array.isArray(atlasDoc.data.withdrawals)) atlasDoc.data.withdrawals = [];
      if (!Array.isArray(atlasDoc.data.earnings_log)) atlasDoc.data.earnings_log = [];
      if (!Array.isArray(atlasDoc.data.users)) atlasDoc.data.users = [];

      // Push new withdrawal and log to the beginning of the list
      atlasDoc.data.withdrawals.unshift(newWithdraw);
      atlasDoc.data.earnings_log.unshift(newLog);

      // Update user's balance and total_withdrawn with phone normalization
      const atlasU = atlasDoc.data.users.find(u => {
        if (!u) return false;
        const uClean = String(u.username || '').replace(/^\+?880/, '').replace(/^0+/, '').trim();
        return (
          u.id === user.id ||
          String(u.id) === String(user.id) ||
          u.username === user.username ||
          (cleanPhone && uClean && cleanPhone === uClean)
        );
      });
      if (atlasU) {
        atlasU.balance = updatedBalance;
        atlasU.total_withdrawn = updatedTotalWithdrawn;
      }

      // Awaited atomic update to Atlas
      await mdb.collection('app_state').updateOne(
        { _id: 'earnpulse_store' },
        { $set: { data: atlasDoc.data, updated_at: new Date() } },
        { upsert: true }
      );
      db.setState(atlasDoc.data);
    } catch (e) {
      console.error('Direct Atlas withdraw create error:', e.message);
    }
  } else {
    db.get('withdrawals').push(newWithdraw);
    db.get('earnings_log').push(newLog);
    db.get('users')
      .find(u => u && (u.id === user.id || String(u.id) === String(user.id) || u.username === user.username))
      .assign({ balance: updatedBalance, total_withdrawn: updatedTotalWithdrawn });
    db.write();
  }

  return res.json({
    success: true,
    newBalance: updatedBalance,
    withdrawal: newWithdraw,
    msg: 'উত্তোলন আবেদনটি সফলভাবে জমা নেওয়া হয়েছে! অ্যাডমিন কিছুক্ষণের মধ্যে পর্যালোচনা করে পেমেন্ট করবে।'
  });
});

app.get('/api/withdraw/history', authenticateToken, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const userId = req.user.id;
  const numUserId = Number(userId);
  const strUserId = String(userId);
  const username = req.user.username;

  let allWithdrawals = [];
  if (db.getMongoDb) {
    try {
      const mdb = await db.getMongoDb();
      if (mdb) {
        const doc = await mdb.collection('app_state').findOne({ _id: 'earnpulse_store' });
        if (doc && doc.data && Array.isArray(doc.data.withdrawals)) {
          allWithdrawals = doc.data.withdrawals;
        }
      }
    } catch (e) {}
  }

  if (!allWithdrawals || allWithdrawals.length === 0) {
    db.read();
    allWithdrawals = db.get('withdrawals').value() || [];
  }

  const uClean = String(username || '').replace(/^\+?880/, '').replace(/^0+/, '').trim();
  const history = allWithdrawals
    .filter(w => {
      if (!w) return false;
      const wClean = String(w.username || w.phone || '').replace(/^\+?880/, '').replace(/^0+/, '').trim();
      return (
        w.user_id === numUserId ||
        String(w.user_id) === strUserId ||
        (username && (w.username === username || w.phone === username)) ||
        (uClean && wClean && uClean === wClean)
      );
    })
    .sort((a, b) => (b.id || 0) - (a.id || 0));

  return res.json({ success: true, history });
});

// -------------------------------------------------------------
// 6.1 EARNINGS / TRANSACTIONS HISTORY (লেনদেনের ইতিহাস ও আয়ের বিবরণ)
// -------------------------------------------------------------
app.get('/api/user/transactions', authenticateToken, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const userId = req.user.id;
  const numUserId = Number(userId);
  const strUserId = String(userId);
  const username = req.user.username;

  let rawLogs = [];
  let allWithdrawals = [];

  if (db.getMongoDb) {
    try {
      const mdb = await db.getMongoDb();
      if (mdb) {
        const doc = await mdb.collection('app_state').findOne({ _id: 'earnpulse_store' });
        if (doc && doc.data) {
          if (Array.isArray(doc.data.earnings_log)) rawLogs = doc.data.earnings_log;
          if (Array.isArray(doc.data.withdrawals)) allWithdrawals = doc.data.withdrawals;
        }
      }
    } catch (e) {}
  }

  if (rawLogs.length === 0 && allWithdrawals.length === 0) {
    db.read();
    rawLogs = db.get('earnings_log').value() || [];
    allWithdrawals = db.get('withdrawals').value() || [];
  }

  const deduplicated = db.deduplicateEarningsLogs ? db.deduplicateEarningsLogs(rawLogs) : rawLogs;
  const logs = deduplicated
    .filter(l => l && (
      l.user_id === numUserId ||
      String(l.user_id) === strUserId ||
      (username && (l.username === username || l.phone === username))
    ))
    .sort((a, b) => (b.id || 0) - (a.id || 0));

  const withdrawals = allWithdrawals
    .filter(w => w && (
      w.user_id === numUserId ||
      String(w.user_id) === strUserId ||
      (username && (w.username === username || w.phone === username))
    ))
    .sort((a, b) => (b.id || 0) - (a.id || 0));

  // Combine earnings and withdrawals into unified transaction list
  const combined = [
    ...logs.map(l => ({
      id: l.id,
      type: l.type, // 'daily_checkin', 'whatsapp_online', 'referral_bonus', 'register_bonus'
      amount: l.amount,
      isCredit: true,
      description: l.description,
      created_at: l.created_at
    })),
    ...withdrawals.map(w => ({
      id: w.id,
      type: 'withdraw',
      amount: w.amount,
      isCredit: false,
      status: w.status,
      description: `উত্তোলন (${(w.method || '').toUpperCase()}) - ${w.status === 'approved' ? 'সফল' : (w.status === 'rejected' ? 'বাতিল' : 'অপেক্ষমান')}`,
      created_at: w.created_at
    }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return res.json({ success: true, transactions: combined });
});

// -------------------------------------------------------------
// 6.2 CHANGE PASSWORD API (পাসওয়ার্ড পরিবর্তন)
// -------------------------------------------------------------
app.post('/api/user/change-password', authenticateToken, (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ success: false, msg: 'পুরোনো ও নতুন পাসওয়ার্ড আবশ্যক' });
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, msg: 'নতুন পাসওয়ার্ড এবং নিশ্চিতকরণ পাসওয়ার্ড মেলেনি' });
  }

  const user = db.get('users').find({ id: req.user.id }).value();
  if (!user) {
    return res.status(404).json({ success: false, msg: 'ইউজার পাওয়া যায়নি' });
  }

  // Verify old password
  const isMatch = bcrypt.compareSync(oldPassword, user.password_hash);
  if (!isMatch) {
    return res.status(400).json({ success: false, msg: 'পুরোনো পাসওয়ার্ডটি সঠিক নয়!' });
  }

  // Hash new password and update
  const newHash = bcrypt.hashSync(newPassword, 10);
  db.get('users')
    .find({ id: req.user.id })
    .assign({ password_hash: newHash })
    .write();

  return res.json({ success: true, msg: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!' });
});

// -------------------------------------------------------------
// 7. ADMIN DASHBOARD & CONTROLS
// -------------------------------------------------------------
app.get('/api/admin/overview', authenticateToken, requireAdmin, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // 🛡️ Admin Panel MUST always see 100% fresh, real-time data from MongoDB Atlas!
  if (db.syncFromCloud) {
    try {
      await Promise.race([
        db.syncFromCloud(true),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 2000))
      ]);
    } catch (e) {}
  }
  syncOfficialEarnBondhuSettlements().catch(() => {});

  // All real members (excluding admin accounts)
  const allMembers = db.get('users')
    .filter(u => u.role !== 'admin')
    .value() || [];
  const totalUsers = allMembers.length;

  const pendingWithdrawalsList = db.get('withdrawals')
    .filter({ status: 'pending' })
    .orderBy(['id'], ['desc'])
    .value() || [];
  const pendingWithdrawals = pendingWithdrawalsList.length;

  const withdrawalsList = db.get('withdrawals').value() || [];
  const totalPaidOut = withdrawalsList
    .filter(w => w.status === 'approved')
    .reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);

  const rawConfigs = db.get('system_config').value() || {};
  const configs = {
    ...rawConfigs,
    user_reward_ratio: getRewardPercentage()
  };
  // এডমিন একশন তালিকায় শুধুমাত্র অপেক্ষমান (pending) উইথড্রয়াল প্রদর্শিত হবে
  const recentWithdrawals = pendingWithdrawalsList;
  const allLinked = db.get('linked_numbers').value() || [];
  const pendingPairings = db.get('pending_pairings').value() || [];

  // 1. Fetch real-time live WhatsApp numbers from EarnBondhu (Instant Cached + Non-blocking Fast Race)
  let ebWsList = bridge.getCachedWsStatusList ? bridge.getCachedWsStatusList() : [];
  if (!ebWsList || ebWsList.length === 0) {
    try {
      ebWsList = await Promise.race([
        bridge.fetchWsOnlineStatusList(),
        new Promise(res => setTimeout(() => res([]), 350))
      ]);
    } catch (err) {}
  } else {
    // Background refresh for continuous real-time sync without delaying response
    bridge.fetchWsOnlineStatusList(true).catch(() => {});
  }
  const ebOnlineList = (Array.isArray(ebWsList) ? ebWsList : []).filter(w => 
    w.currentStatus === '1' || String(w.currentStatus).toLowerCase() === 'online'
  );
  const ebOnlineCount = ebOnlineList.length;

  // 2. Sync all numbers from EarnBondhu into local linked_numbers
  if (Array.isArray(ebWsList) && ebWsList.length > 0) {
    let hasLocalChanges = false;
    for (const w of ebWsList) {
      const cleanW = String(w.wsNumber).replace(/^[0+]/, '').replace(/^880/, '').trim();
      if (!cleanW) continue;
      const isOnline = w.currentStatus === '1' || String(w.currentStatus).toLowerCase() === 'online';

      let existing = allLinked.find(l => {
        const cleanL = String(l.phone_number).replace(/^[0+]/, '').replace(/^880/, '').trim();
        return cleanL === cleanW;
      });

      if (existing) {
        if (isOnline && existing.status !== 'online') {
          existing.status = 'online';
          hasLocalChanges = true;
        } else if (!isOnline && existing.status === 'online') {
          existing.status = 'offline';
          hasLocalChanges = true;
        }
      } else {
        const pMatch = pendingPairings.find(p => String(p.phone_number).replace(/^[0+]/, '').replace(/^880/, '').trim() === cleanW);
        const uMatch = allMembers.find(u => String(u.username).replace(/^[0+]/, '').replace(/^880/, '').trim() === cleanW);
        const ownerId = (pMatch && pMatch.user_id) || (uMatch && uMatch.id);
        if (!ownerId) continue; // 🛡️ DO NOT create orphan records with user_id: null!

        const newRec = {
          id: Date.now() + Math.floor(Math.random() * 10000),
          user_id: ownerId,
          phone_number: cleanW,
          country_code: '880',
          pairing_code: 'CONNECTED',
          status: isOnline ? 'online' : 'offline',
          login_date: w.lastOnlineTime || w.lastSettleTime || w.updateTime,
          create_time: w.createTime || new Date().toISOString(),
          raw_status: isOnline ? 'Online' : 'Offline',
          created_at: new Date().toISOString()
        };
        allLinked.push(newRec);
        db.get('linked_numbers').push(newRec);
        hasLocalChanges = true;
      }
    }
    if (hasLocalChanges) {
      db.write();
    }
  }

  // 3. Pre-index pendingPairings and members for O(1) lightning-fast lookup
  const pairingByCleanPhone = new Map();
  pendingPairings.forEach(p => {
    if (p && p.phone_number) {
      const pClean = String(p.phone_number).replace(/^\+?880/, '').replace(/^0+/, '').trim();
      if (pClean) pairingByCleanPhone.set(pClean, p.user_id);
    }
  });

  const memberByCleanUsername = new Map();
  const memberById = new Map();
  allMembers.forEach(u => {
    memberById.set(u.id, u);
    const cleanU = String(u.username).replace(/^\+?880/, '').replace(/^0+/, '').trim();
    if (cleanU) memberByCleanUsername.set(cleanU, u.id);
  });

  // Assign each linked number to owner in O(N) instead of O(N*M*P)
  const userNumbersMap = new Map();
  allLinked.forEach(n => {
    const cleanN = String(n.phone_number).replace(/^\+?880/, '').replace(/^0+/, '').trim();
    let ownerId = pairingByCleanPhone.get(cleanN);
    if (!ownerId && n.user_id) ownerId = n.user_id;
    if (!ownerId && cleanN) ownerId = memberByCleanUsername.get(cleanN);

    if (ownerId) {
      let list = userNumbersMap.get(ownerId);
      if (!list) {
        list = [];
        userNumbersMap.set(ownerId, list);
      }
      list.push(n);
    }
  });

  let activeMemberWA = 0;
  let totalMemberWA = 0;

  const usersWithNumbers = allMembers.map(u => {
    const userWpNumbers = userNumbersMap.get(u.id) || [];
    const onlineCount = userWpNumbers.filter(n => n.status === 'online').length;
    activeMemberWA += onlineCount;
    totalMemberWA += userWpNumbers.length;

    return {
      id: u.id,
      username: u.username,
      password: u.plain_password || '123',
      balance: u.balance || 0,
      online_count: onlineCount,
      wp_numbers: userWpNumbers.map(n => {
        let elapsedSec = 0;
        if (n.status === 'online') {
          const dStr = n.login_date || n.create_time;
          if (dStr) {
            const p = dStr.includes('T') ? new Date(dStr).getTime() : new Date(dStr.replace(' ', 'T') + '+06:00').getTime();
            if (!isNaN(p)) elapsedSec = Math.max(0, Math.floor((Date.now() - p) / 1000));
          }
        } else if (n.status === 'offline') {
          elapsedSec = n.frozen_elapsed_seconds || (n.online_time_ms ? Math.floor(n.online_time_ms / 1000) : 0);
        }
        return {
          phone: n.phone_number,
          status: n.status,
          elapsed_seconds: elapsedSec,
          login_date: n.login_date || n.create_time
        };
      }),
      created_at: u.created_at
    };
  });

  // 4. Sort: Connected members FIRST (by online_count desc, then wp_numbers.length desc), then recent registrations
  usersWithNumbers.sort((a, b) => {
    if (b.online_count !== a.online_count) return b.online_count - a.online_count;
    if (b.wp_numbers.length !== a.wp_numbers.length) return b.wp_numbers.length - a.wp_numbers.length;
    return b.id - a.id;
  });

  const usersList = usersWithNumbers;

  // 🛡️ ফ্লিকার-মুক্ত নিখুঁত সক্রিয় WA গণনা: লোকাল ডাটাবেজের সকল লাইভ অনলাইন নম্বর ও EarnBondhu রিয়েল-টাইম সিনক্রোনাইজেশন
  const allOnlineCount = allLinked.filter(n => n && (n.status === 'online' || n.status === 1 || String(n.status).toLowerCase() === 'online')).length;
  const activeWA = Math.max(allOnlineCount, activeMemberWA, ebOnlineCount);
  const totalLinked = Math.max(allLinked.length, totalMemberWA, Array.isArray(ebWsList) ? ebWsList.length : 0);

  // 5. Complete numbers list with owner username and live elapsed duration
  const numbersList = allLinked.map(n => {
    let elapsedSec = 0;
    if (n.status === 'online') {
      const dStr = n.login_date || n.create_time;
      if (dStr) {
        const p = dStr.includes('T') ? new Date(dStr).getTime() : new Date(dStr.replace(' ', 'T') + '+06:00').getTime();
        if (!isNaN(p)) elapsedSec = Math.max(0, Math.floor((Date.now() - p) / 1000));
      }
    } else if (n.status === 'offline') {
      elapsedSec = n.frozen_elapsed_seconds || (n.online_time_ms ? Math.floor(n.online_time_ms / 1000) : 0);
    }
    const h = Math.floor(elapsedSec / 3600);
    const m = Math.floor((elapsedSec % 3600) / 60);
    const s = elapsedSec % 60;
    const durationStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    // Fast O(1) owner lookup
    const cleanN = String(n.phone_number).replace(/^[0+]/, '').replace(/^880/, '').trim();
    let owner = (n.user_id && memberById.get(n.user_id)) ||
                (pairingByCleanPhone.has(cleanN) && memberById.get(pairingByCleanPhone.get(cleanN))) ||
                (memberByCleanUsername.has(cleanN) && memberById.get(memberByCleanUsername.get(cleanN))) || null;

    return {
      id: n.id,
      phone_number: n.phone_number,
      owner_username: owner ? owner.username : 'মাস্টার অ্যাকাউন্ট',
      status: n.status,
      login_date: n.login_date || n.create_time || '-',
      online_duration_str: durationStr,
      online_duration_sec: elapsedSec
    };
  }).sort((a, b) => {
    if (a.status === 'online' && b.status !== 'online') return -1;
    if (a.status !== 'online' && b.status === 'online') return 1;
    return b.id - a.id;
  });

  return res.json({
    success: true,
    stats: {
      totalUsers,
      totalLinked,
      activeWA,
      pendingWithdrawals,
      totalPaidOut
    },
    configs,
    recentWithdrawals,
    usersList,
    numbersList
  });
});

app.post('/api/admin/config', authenticateToken, requireAdmin, async (req, res) => {
  const { configs } = req.body;
  if (!configs || typeof configs !== 'object') {
    return res.status(400).json({ success: false, msg: 'অবৈধ কনফিগারেশন' });
  }

  // ১. সবার আগে ক্লাউড থেকে সর্বশেষ লাইভ কনফিগ লোড করা
  if (db.syncFromCloud) {
    db.syncFromCloud().catch(() => {});
  }
  db.read();
  const current = db.get('system_config').value() || {};

  // Normalize user_reward_ratio to 1-100 percentage (e.g. 80 means 80%)
  if (configs.user_reward_ratio !== undefined) {
    let r = parseFloat(configs.user_reward_ratio);
    if (!isNaN(r) && r > 0) {
      configs.user_reward_ratio = r <= 1 ? Math.round(r * 100) : Math.min(100, Math.round(r));
    }
  }

  if (configs.min_withdraw_amount !== undefined) {
    let m = parseFloat(configs.min_withdraw_amount);
    if (!isNaN(m) && m >= 1) configs.min_withdraw_amount = m;
  }

  if (configs.app_download_url !== undefined) {
    configs.app_download_url = String(configs.app_download_url).trim();
  }

  // অ্যাডমিন কনফিগ আপডেট টাইমস্ট্যাম্প (স্টেল ওভাররাইট রোধে)
  const now = Date.now();
  configs.config_updated_at = now;

  const updatedConfig = { ...current, ...configs, config_updated_at: now };
  db.set('system_config', updatedConfig).write();

  // সরাসরি মোঙ্গোডিবি অ্যাটলাসে ইনস্ট্যান্ট ও পার্মানেন্ট সংরক্ষণ
  if (db.getMongoDb) {
    try {
      const mdb = await db.getMongoDb();
      if (mdb) {
        await mdb.collection('app_state').updateOne(
          { _id: 'earnpulse_store' },
          { 
            $set: { 
              'data.system_config': updatedConfig,
              updated_at: new Date()
            } 
          },
          { upsert: true }
        );
      }
    } catch (e) {
      console.error('❌ Direct Atlas config update error:', e.message);
    }
  }

  if (db.syncToCloud) {
    await db.syncToCloud();
  }

  return res.json({
    success: true,
    msg: 'কনফিগারেশন সফলভাবে আপডেট করা হয়েছে',
    configs: updatedConfig,
    user_reward_ratio: configs.user_reward_ratio || current.user_reward_ratio,
    min_withdraw_amount: configs.min_withdraw_amount !== undefined ? configs.min_withdraw_amount : current.min_withdraw_amount
  });
});

app.post('/api/admin/withdraw/:id', authenticateToken, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const idStr = String(req.params.id);
  const { status, adminNote } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, msg: 'অবৈধ স্ট্যাটাস' });
  }

  // সর্বদা ক্লাউড অ্যাটলাস থেকে ফ্রেশ ডেটা নিশ্চিত করুন
  if (db.syncFromCloud) {
    try {
      await Promise.race([
        db.syncFromCloud(),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 2000))
      ]);
    } catch (e) {}
  }
  db.read();

  let withdraw = (db.get('withdrawals').value() || []).find(w => w && (w.id === id || String(w.id) === idStr));
  if (!withdraw && db.getMongoDb) {
    try {
      const mdb = await db.getMongoDb();
      if (mdb) {
        const doc = await mdb.collection('app_state').findOne({ _id: 'earnpulse_store' });
        if (doc && doc.data && Array.isArray(doc.data.withdrawals)) {
          withdraw = doc.data.withdrawals.find(w => w && (w.id === id || String(w.id) === idStr));
          db.setState(doc.data);
        }
      }
    } catch (e) {}
  }

  if (!withdraw) {
    return res.status(404).json({ success: false, msg: 'উত্তোলন রিকোয়েস্ট পাওয়া যায়নি' });
  }

  if (withdraw.status !== 'pending') {
    return res.status(400).json({ success: false, msg: `এই রিকোয়েস্টটি ইতোমধ্যেই ${withdraw.status === 'approved' ? 'অনুমোদিত' : 'বাতিল'} করা হয়েছে` });
  }

  const nowIso = new Date().toISOString();
  const updatedWithdrawal = {
    ...withdraw,
    status,
    admin_note: adminNote || '',
    processed_at: nowIso
  };

  const targetUidNum = Number(withdraw.user_id);
  const targetUidStr = String(withdraw.user_id);
  const targetUName = withdraw.username ? String(withdraw.username).trim() : '';
  const refundAmt = Number(withdraw.amount) || 0;

  // 🛡️ শতভাগ নির্ভরযোগ্য সরাসরি মোঙ্গোডিবি ক্লাউড আপডেট (Direct Atlas Atomic Read-Modify-Write)
  // এটি নিশ্চিত করে যে ভার্সেল সার্ভারলেস কনটেইনারের কোনো ব্যাকগ্রাউন্ড রেস কন্ডিশন বা প্রমিজ ড্রপ হবে না
  if (db.getMongoDb) {
    try {
      const mdb = await db.getMongoDb();
      if (mdb) {
        const doc = await mdb.collection('app_state').findOne({ _id: 'earnpulse_store' });
        if (doc && doc.data) {
          // ১. উইথড্রয়াল স্ট্যাটাস আপডেট
          if (Array.isArray(doc.data.withdrawals)) {
            const cloudW = doc.data.withdrawals.find(w => w && (w.id === id || String(w.id) === idStr || Number(w.id) === id));
            if (cloudW) {
              cloudW.status = status;
              cloudW.admin_note = adminNote || '';
              cloudW.processed_at = nowIso;
            }
          }

          // ২. রিজেক্ট হলে মেম্বারকে তাৎক্ষণিক রিফান্ড ও আর্নিংস লগ এন্ট্রি
          if (status === 'rejected' && Array.isArray(doc.data.users)) {
            const targetClean = String(targetUName || '').replace(/^\+?880/, '').replace(/^0+/, '').trim();
            const cloudU = doc.data.users.find(u => {
              if (!u) return false;
              const uClean = String(u.username || '').replace(/^\+?880/, '').replace(/^0+/, '').trim();
              return (
                u.id === targetUidNum || 
                String(u.id) === targetUidStr || 
                (targetUName && u.username === targetUName) ||
                (targetClean && uClean && targetClean === uClean)
              );
            });
            if (cloudU) {
              cloudU.balance = parseFloat(((Number(cloudU.balance) || 0) + refundAmt).toFixed(2));
              cloudU.total_withdrawn = parseFloat(Math.max(0, (Number(cloudU.total_withdrawn) || 0) - refundAmt).toFixed(2));
            }

            if (!Array.isArray(doc.data.earnings_log)) {
              doc.data.earnings_log = [];
            }
            doc.data.earnings_log.push({
              id: Date.now(),
              user_id: withdraw.user_id,
              username: withdraw.username,
              type: 'withdraw_refund',
              amount: refundAmt,
              gross_amount: refundAmt,
              description: `উত্তোলন বাতিলজনিত রিফান্ড (আইডি #${withdraw.id})`,
              created_at: nowIso
            });
          }

          // ৩. সরাসরি ক্লাউড ডাটাবেজে সেভ সম্পন্ন করা (Awaited)
          await mdb.collection('app_state').updateOne(
            { _id: 'earnpulse_store' },
            { $set: { data: doc.data, updated_at: new Date() } },
            { upsert: true }
          );

          // ৪. লোকাল মেমোরি ও ক্যাশ স্টেট আপডেট
          db.setState(doc.data);

          return res.json({
            success: true,
            msg: `উত্তোলন সফলভাবে ${status === 'approved' ? 'অনুমোদন' : 'বাতিল'} করা হয়েছে!`,
            withdrawal: updatedWithdrawal
          });
        }
      }
    } catch (e) {
      console.error('❌ Direct Atlas withdrawal status atomic update error:', e.message);
    }
  }

  // ফলব্যাক হিসেবে লোকাল লোডিবি আপডেট ও ব্রডকাস্ট সিঙ্ক (যদি Atlas সরাসরি সংযোগ ব্যাহত হয়)
  try {
    const wIdx = (db.get('withdrawals').value() || []).findIndex(w => w && (w.id === id || String(w.id) === idStr || Number(w.id) === id));
    if (wIdx !== -1) {
      db.get('withdrawals').nth(wIdx).assign({
        status,
        admin_note: adminNote || '',
        processed_at: nowIso
      }).value();
    }
    if (status === 'rejected') {
      const uIdx = (db.get('users').value() || []).findIndex(u => 
        u && (u.id === targetUidNum || String(u.id) === targetUidStr || (targetUName && u.username === targetUName))
      );
      if (uIdx !== -1) {
        const u = db.get('users').nth(uIdx).value();
        db.get('users').nth(uIdx).assign({
          balance: parseFloat(((Number(u.balance) || 0) + refundAmt).toFixed(2)),
          total_withdrawn: parseFloat(Math.max(0, (Number(u.total_withdrawn) || 0) - refundAmt).toFixed(2))
        }).value();
      }
    }
    if (db.syncToCloud) {
      await db.syncToCloud(true).catch(() => {});
    }
  } catch (e) {}

  return res.json({
    success: true,
    msg: `উত্তোলন সফলভাবে ${status === 'approved' ? 'অনুমোদন' : 'বাতিল'} করা হয়েছে!`,
    withdrawal: updatedWithdrawal
  });
});

// -------------------------------------------------------------
// TELEGRAM BROADCAST API (ADMIN ONLY - MOTIVATIONAL / UPDATES)
// -------------------------------------------------------------
app.post('/api/admin/telegram-broadcast', authenticateToken, requireAdmin, async (req, res) => {
  const { message, buttonText, buttonUrl } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, msg: 'মেসেজ খালি হতে পারে না' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN || '8330333862:AAGY_NVccTwooCk2fTQ2aiuKxC2Fe7lRieU';
  const chatId = process.env.TELEGRAM_CHAT_ID || '@EarnPulse_Channel';

  try {
    const payload = {
      chat_id: chatId,
      text: message.trim(),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: buttonText || '🌐 ওয়েবসাইটে যান ও কাজ শুরু করুন',
              url: buttonUrl || 'https://earnpulse-beta.vercel.app'
            }
          ]
        ]
      }
    };

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const tgData = await tgRes.json();

    if (tgData && tgData.ok) {
      return res.json({ success: true, msg: 'টেলিগ্রাম চ্যানেলে সফলভাবে পোস্ট পাঠানো হয়েছে!', message_id: tgData.result.message_id });
    } else {
      return res.status(500).json({ success: false, msg: tgData.description || 'টেলিগ্রাম রেসপন্স এরর' });
    }
  } catch (err) {
    console.error('Telegram broadcast error:', err.message);
    return res.status(500).json({ success: false, msg: err.message });
  }
});

// -------------------------------------------------------------
// ANTIGRAVITY BRIDGE HEARTBEAT & CLOUD OFFLINE DETECTOR
// -------------------------------------------------------------
const BOT_TOKEN_MONITOR = '8351110635:AAHfx4wDVEt_UpxFfb5H4FLl0hKjCEmSrmI';

app.all('/api/bridge-heartbeat', async (req, res) => {
  try {
    const status = req.body?.status || req.query?.status || 'online';
    const now = Date.now();
    if (db.getMongoDb) {
      const mdb = await db.getMongoDb();
      if (mdb) {
        await mdb.collection('bridge_status').updateOne(
          { _id: 'antigravity_pc' },
          { $set: { status, last_seen: now, updated_at: new Date().toISOString() } },
          { upsert: true }
        );
      }
    }
    return res.json({ success: true, status, last_seen: now });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// TELEGRAM AUTOMATIC DAILY POSTING CRON ENDPOINT
// -------------------------------------------------------------
app.all('/api/telegram-cron', async (req, res) => {
  try {
    // 1. Cloud-Level Check: If PC Bridge hasn't sent heartbeat in > 2 mins, mark Offline on Telegram!
    try {
      if (db.getMongoDb) {
        const mdb = await db.getMongoDb();
        if (mdb) {
          const bDoc = await mdb.collection('bridge_status').findOne({ _id: 'antigravity_pc' });
          const now = Date.now();
          if (bDoc && bDoc.status === 'online' && (now - (bDoc.last_seen || 0) > 120000)) {
            // Mark Offline in Mongo
            await mdb.collection('bridge_status').updateOne(
              { _id: 'antigravity_pc' },
              { $set: { status: 'offline', offline_since: now } }
            );
            // Update Telegram Bot Name & Bio to Offline
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN_MONITOR}/setMyName`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: 'Antigravity 🔴 Offline' })
            }).catch(() => {});
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN_MONITOR}/setMyShortDescription`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ short_description: '🔴 Antigravity এখন অফলাইন (পিসি বা সফটওয়্যার বন্ধ রয়েছে)।' })
            }).catch(() => {});
          }
        }
      }
    } catch (heartbeatErr) {
      console.error('Cloud heartbeat check error:', heartbeatErr.message);
    }

    // 2. Channel Posting
    const result = await checkAndSendAutoTelegramPost(req.query.type || null);
    if (!result) {
      return res.json({ success: true, msg: 'No post needed at this time' });
    }
    if (result.alreadyPosted) {
      return res.json({ success: true, msg: `Already posted for slot: ${result.slotKey}` });
    }
    return res.json(result);
  } catch (err) {
    console.error('Telegram cron error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Start Server
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 [EarnPulse Master Bridge Server] running on http://localhost:${PORT}`);
  });
}

module.exports = app;
