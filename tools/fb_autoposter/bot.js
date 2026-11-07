const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Chrome executable path
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = path.join(__dirname, 'chrome_profile');
const BANNER_PATH = path.join(__dirname, '../../frontend/public/downloads/EarnPulse_Square_Flyer.jpg');

// -------------------------------------------------------------
// UNLIMITED AI DYNAMIC LINK GENERATOR
// -------------------------------------------------------------
async function getDynamicPromoLink(index) {
  const randomSalt = Math.random().toString(36).substring(2, 7);
  const targetWithParam = `https://earnpulse-beta.vercel.app/register?invite=4E2YOO&t=${randomSalt}_${Date.now()}`;
  
  // 1. Try dynamic is.gd API for completely unique on-the-fly shortlink
  try {
    const res = await Promise.race([
      fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(targetWithParam)}`),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
    ]);
    if (res.ok) {
      const shortUrl = (await res.text()).trim();
      if (shortUrl.startsWith('http')) return shortUrl;
    }
  } catch (e) {}

  // 2. Try dynamic clck.ru API for unique shortlink
  try {
    const res = await Promise.race([
      fetch(`https://clck.ru/--?url=${encodeURIComponent(targetWithParam)}`),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
    ]);
    if (res.ok) {
      const shortUrl = (await res.text()).trim();
      if (shortUrl.startsWith('http')) return shortUrl;
    }
  } catch (e) {}

  // 3. Fallback to randomized Edge Slugs with unique salt
  const slugs = ['join', 'bonus', 'cash', 'start', 'income', 'free', 'bounty'];
  const slug = slugs[Math.floor(Math.random() * slugs.length)];
  return `https://earnpulse-beta.vercel.app/${slug}?s=${randomSalt}`;
}

// -------------------------------------------------------------
// UNLIMITED AI BANGLA POST COPY SYNTHESIZER (1,200,000+ Permutations)
// -------------------------------------------------------------
const HOOKS = [
  "📱 ঘরে অলস পড়ে থাকা যেকোনো সাধারণ সিম দিয়ে WhatsApp কানেক্ট রাখলেই প্রতিদিন ৩০০-১০০০ টাকা নগদ ইনকাম! 💸",
  "🔥 অতিরিক্ত বা অলস সিম ফেলে না রেখে মোবাইল দিয়েই ঘরে বসে দৈনিক নিশ্চিত ইনকাম করুন! 🇧🇩",
  "✨ ছাত্র-ছাত্রী ও বেকার ভাইদের জন্য পার্ট-টাইম অনলাইন ইনকামের অবিশ্বাস্য সেরা সুযোগ! 🎓",
  "☕ চা-নাস্তার খরচ ও দৈনিক হাতখরচ এখন আসবে আপনার মোবাইলের অব্যবহৃত WhatsApp থেকে! 💰",
  "🚨 সীমিত সময়ের জন্য বিশাল আর্নিং অফার চলছে—কোনো ইনভেস্টমেন্ট ছাড়াই ফ্রি ইনকাম! ⚡",
  "🏆 ১০০% রিয়েল ও পরীক্ষিত প্ল্যাটফর্ম—প্রতিদিন বিকাশ ও নগদে সরাসরি ক্যাশআউট বুঝে নিন! 💵",
  "📲 আপনার ফোনে কি দুটি সিম আছে? একটা দিয়ে কি নিয়মিত WhatsApp চালান না? তবে এটি আপনার জন্যই! 🎯",
  "👑 অলস বসে না থেকে হাতে থাকা সাধারণ স্মার্টফোন দিয়ে প্রতিদিন নিশ্চিত নগদ আয় শুরু করুন! 🌟",
  "🤑 সবচেয়ে সহজ ইনকাম মাধ্যম—কোনো কঠিন কাজ বা ফ্রিল্যান্সিং স্কিল ছাড়াই অটো আর্নিং! 🚀",
  "💎 মাত্র ১ ক্লিকে শুরু করুন—যেখানে WhatsApp কানেক্ট থাকলেই প্রতি ২৪ ঘণ্টায় অটো ব্যালেন্স জমা! ⏳",
  "🎁 প্রতিদিন শত শত মেম্বার সফলভাবে পেমেন্ট নিচ্ছে—আপনি কেন পিছিয়ে থাকবেন? 🥳",
  "⚡ ইনস্ট্যান্ট নগদ উইথড্র সুবিধা সহ ২০২৬ সালের সেরা ও বিশ্বস্ত আর্নিং প্ল্যাটফর্ম EarnPulse! 🇧🇩"
];

const EXPLANATIONS = [
  "এখানে কোনো টাকা ইনভেস্ট করতে হয় না। শুধু অব্যবহৃত সিম দিয়ে WhatsApp স্ক্যান করে কানেক্ট রাখলেই প্রতি ২৪ ঘণ্টায় অটো টাকা জমা হতে থাকে।",
  "আপনার অলস সিমের WhatsApp সাইটে একবার লিঙ্ক করে রাখুন, ব্যস! সারাদিন ব্যালেন্স নিজে থেকেই বাড়তে থাকবে।",
  "কোনো বাড়তি কাজ নেই, ভিডিও দেখতে হয় না বা ক্যাপচা পূরণ করতে হয় না—শুধু নম্বর কানেক্ট থাকলেই নিশ্চিত আয়।",
  "যত বেশি সিম দিয়ে WhatsApp কানেক্ট রাখবেন, প্রতিদিনের ইনকাম তত গুণ বেশি বৃদ্ধি পাবে।",
  "মোবাইল ডেটা বা ওয়াইফাই খুব সামান্যই লাগে, কিন্তু ইনকাম আসে নিয়মিত ও সম্পূর্ণ নিশ্চিন্তে।",
  "সম্পূর্ণ অটোমেটিক সিস্টেম—একবার কানেক্ট করার পর আপনার আর কোনো প্রকার ঝামেলার দরকার নেই।",
  "ঘরে বসেই অবসর সময়ে প্রতিদিন পকেট খরচ তোলার জন্য এটি বাংলাদেশের সবচেয়ে সহজ ও বিশ্বস্ত মাধ্যম।",
  "১০০% নিরাপদ ও সিকিউর পদ্ধতি—আপনার ব্যক্তিগত মেসেজ বা ব্যক্তিগত কলের কোনো ক্ষতি হবে না।"
];

const BOUNTIES = [
  "🎁 ১ম নম্বর কানেক্ট করলেই সাথে সাথে ১০৳ ফ্রি ওয়েলকাম বোনাস!",
  "💸 ধামাকা অফার: মাত্র ২ জন বন্ধুকে যুক্ত করালেই পাচ্ছেন ৩০০৳ নগদ ক্যাশ বোনাস!",
  "🌟 স্পেশাল মেগা বাউন্টি: ২ রেফার করলেই সরাসরি ৩০০ টাকা বিকাশ বা নগদে ক্যাশআউট!",
  "🔥 বন্ধুদের ইনভাইট করে টিম তৈরি করুন—প্রতিটি রেফার থেকে আজীবন ১৫% ১ম স্তর ও ৫% ২য় স্তর কমিশন!",
  "🎉 নতুন মেম্বারদের জন্য রয়েছে ওয়েলকাম গিফট ও আনলিমিটেড রেফারেল ক্যাশ রিওয়ার্ড!",
  "💰 সীমিত সময়ের জন্য ২ রেফারে ৩০০৳ ইনস্ট্যান্ট ক্যাশ লুফে নেওয়ার মেগা সুযোগ চলছে!",
  "⚡ প্রতিদিন ডেইলি চেক-ইন কয়েন বোনাস এবং প্রতি রেফারে আকর্ষণীয় নগদ ক্যাশ পুরস্কার!",
  "👑 বন্ধুদের স্ট্যাটাস বা গ্রুপে শেয়ার করে ২ জন জয়েন করলেই সাথে সাথে ৩০০৳ নগদ ক্যাশ!"
];

const TRUSTS = [
  "💵 সর্বনিম্ন টাকা হলেই প্রতিদিন সরাসরি বিকাশ ও নগদে পেমেন্ট ক্লিয়ার করে দেওয়া হয়।",
  "✔️ সর্বোচ্চ ২৪ ঘণ্টার মধ্যে ১০০% পেমেন্ট গ্যারান্টি—প্রতিদিন হাজার হাজার মেম্বার পেমেন্ট পাচ্ছে।",
  "🛡️ কোনো ভুয়া সাইট নয়, প্রতিদিন শত শত মেম্বারদের সফল ক্যাশআউট প্রুফ চ্যানেলে শেয়ার করা হচ্ছে।",
  "⚡ বিকাশ, নগদ বা রকেটে যেকোনো সময় উইথড্র রিকোয়েস্ট দিন ও কয়েক ঘণ্টার মধ্যে টাকা বুঝে নিন।",
  "💯 শতভাগ নির্ভরযোগ্য ও বিশ্বস্ত বাংলাদেশি প্ল্যাটফর্ম।",
  "👌 পেমেন্ট নিয়ে কোনো চিন্তা নেই, কাজ করুন এবং সময়মতো আপনার পারিশ্রমিক বুঝে নিন।"
];

const CTAS = [
  "👉 এখনই ফ্রি অ্যাকাউন্ট তৈরি করে আপনার বোনাস বুঝে নিন:\n{{LINK}}",
  "🚀 আর দেরি না করে এখনই শুরু করতে নিচের অফিশিয়াল লিংকে ক্লিক করুন:\n{{LINK}}",
  "📌 রেজিস্ট্রেশন লিংক নিচে দেওয়া হলো, এখনই শুরু করে দিন:\n{{LINK}}",
  "👇 সম্পূর্ণ ফ্রিতে জয়েন করার অফিশিয়াল সাইট লিংক:\n{{LINK}}",
  "✨ আজই জয়েন করুন এবং অবসর সময়কে আয়ে রূপান্তর করুন:\n{{LINK}}",
  "🔗 সরাসরি ফ্রি অ্যাকাউন্ট খোলার লিংক:\n{{LINK}}",
  "🎯 বিস্তারিত দেখতে ও অ্যাকাউন্ট খুলতে এখনই ক্লিক করুন:\n{{LINK}}",
  "📲 জয়েনিং লিংক:\n{{LINK}}"
];

const HASHTAG_BANK = [
  "#OnlineIncomeBD", "#GhoreBoseInkam", "#WhatsAppEarning", "#BkashPayment", 
  "#NagadPayment", "#StudentIncomeBD", "#DailyCash", "#FreeIncome2026", 
  "#MakeMoneyOnlineBD", "#PartTimeJobBD", "#TrustedEarningSite", "#EarnPulseBD"
];

function generateUnlimitedPost(promoLink) {
  const h = HOOKS[Math.floor(Math.random() * HOOKS.length)];
  const e = EXPLANATIONS[Math.floor(Math.random() * EXPLANATIONS.length)];
  const b = BOUNTIES[Math.floor(Math.random() * BOUNTIES.length)];
  const t = TRUSTS[Math.floor(Math.random() * TRUSTS.length)];
  const c = CTAS[Math.floor(Math.random() * CTAS.length)].replace('{{LINK}}', promoLink);

  const shuffledTags = [...HASHTAG_BANK].sort(() => 0.5 - Math.random()).slice(0, 4).join(' ');

  return `${h}\n\n${e}\n\n${b}\n\n${t}\n\n${c}\n\n${shuffledTags}`;
}

// Target Bangladeshi Earning Groups / Search Queries (Expanded Multi-Region Earning Pool)
const TARGET_GROUPS = [
  { name: 'Online Income BD', query: 'Online Income BD' },
  { name: 'ঘরে বসে ইনকাম বাংলাদেশ', query: 'ঘরে বসে ইনকাম' },
  { name: 'ফ্রি ইনকাম সাইট (বিকাশ ও নগদ)', query: 'ফ্রি ইনকাম সাইট বিকাশ পেমেন্ট' },
  { name: 'Online Earning Bangladesh 2026', query: 'Online Earning Bangladesh' },
  { name: 'ছাত্র-ছাত্রীদের অনলাইন পার্ট টাইম ইনকাম', query: 'Student Online Income BD' },
  { name: 'Real Online Income Site & App BD', query: 'Real Online Income Site BD' },
  { name: 'বিকাশ পেমেন্ট ইনকাম গ্রুপ বাংলাদেশ', query: 'বিকাশ পেমেন্ট ইনকাম গ্রুপ' },
  { name: 'দৈনিক ৫০০-১০০০ টাকা ইনকাম করুন', query: 'দৈনিক ৫০০ টাকা ইনকাম' },
  { name: 'Micro Task & Freelancing BD', query: 'Micro Task Bangladesh' },
  { name: 'ফ্রি মোবাইল দিয়ে টাকা আয় করুন', query: 'মোবাইল দিয়ে টাকা আয়' },
  { name: 'Student Job & Earning BD', query: 'Student Job BD' },
  { name: 'Online Earning Community BD', query: 'Online Earning Community BD' },
  { name: 'Digital Marketing & Referral BD', query: 'Referral Income BD' },
  { name: 'বিনা পুঁজিতে অনলাইন ব্যবসা ও ইনকাম', query: 'বিনা পুঁজিতে অনলাইন ইনকাম' },
  { name: 'Active Earning Members BD', query: 'Earning Members Bangladesh' },
  { name: 'ঘরে বসে আয় করুন প্রতিদিন', query: 'ঘরে বসে আয়' },
  { name: 'মোবাইল দিয়ে ফ্রি ইনকাম সাইট', query: 'মোবাইল দিয়ে ফ্রি ইনকাম' },
  { name: 'Instant Payment Income BD', query: 'Instant Payment BD' },
  { name: 'বিকাশ দিয়ে টাকা আয় করার উপায়', query: 'বিকাশ দিয়ে টাকা আয়' },
  { name: 'Part Time Online Jobs BD', query: 'Part Time Online Jobs BD' }
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function promptUser(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

function generateLeadReply(freshLink) {
  const GREETINGS = [
    "আসসালামু আলাইকুম ভাই! 👋",
    "ধন্যবাদ ভাই যোগাযোগ করার জন্য! 🌟",
    "হ্যালো ভাই! সম্পূর্ণ ঘরে বসে অলস সিম দিয়ে ফ্রি আয়ের দারুণ সুযোগ! 📱💸",
    "জি ভাই, ১০০% রিয়েল ও পরীক্ষিত ফ্রি আর্নিং সাইট! 🇧🇩"
  ];
  const g = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

  return `${g}\n\nআপনার অতিরিক্ত বা অলস পড়ে থাকা সাধারণ সিমের WhatsApp সাইটে কানেক্ট রাখলেই প্রতিদিন অটোমেটিক ব্যালেন্স জমা হবে! কোনো ইনভেস্টমেন্ট বা ডিপোজিট লাগে না ($০ টাকা)।\n\n👉 কাজ শুরু করার ৩টি সহজ ধাপ:\n১. নিচের অফিশিয়াল লিংকে ক্লিক করে ফ্রি রেজিস্ট্রেশন করুন:\n${freshLink}\n\n২. সাইটে ঢুকে WhatsApp অপশনে গিয়ে আপনার অব্যবহৃত সিমটি কিউআর কোড বা কোড দিয়ে কানেক্ট করে রাখুন (১ম কানেক্টেই ১০৳ ওয়েলকাম বোনাস! 🎁)।\n\n৩. আপনার রেফারেল লিংক বন্ধুদের দিয়ে মাত্র ২ জনকে কানেক্ট করালেই সাথে সাথে পাচ্ছেন ৩০০৳ সরাসরি নগদ বিকাশ বা নগদে ক্যাশআউট! 💸\n\n⚡ পেমেন্ট প্রতিদিন সরাসরি বিকাশ ও নগদে দেওয়া হয়। এখনই লিংকটিতে ঢুকে আপনার বোনাস বুঝে নিন ভাই!`;
}

// -------------------------------------------------------------
// MODULE 1: BULK AUTO GROUP SEARCH & JOINER
// -------------------------------------------------------------
const JOIN_SEARCH_KEYWORDS = [
  'Online Income BD',
  'ঘরে বসে ইনকাম',
  'ফ্রি ইনকাম সাইট বিকাশ পেমেন্ট',
  'Online Earning Bangladesh',
  'Student Online Income BD'
];

async function autoJoinSearchedGroups(page) {
  console.log('\n============================================================');
  console.log('👥 [বাল্ক অটো গ্রুপ জয়েনার] সেরা ইনকাম গ্রুপগুলো খোঁজা ও স্বয়ংক্রিয়ভাবে জয়েন করা হচ্ছে...');
  console.log('============================================================');

  for (const kw of JOIN_SEARCH_KEYWORDS) {
    try {
      console.log(`🔎 "${kw}" কীওয়ার্ড দিয়ে গ্রুপ সার্চ করা হচ্ছে...`);
      const url = `https://www.facebook.com/search/groups/?q=${encodeURIComponent(kw)}`;
      await page.goto(url, { waitUntil: 'networkidle2' });
      await sleep(3500);

      await page.evaluate(() => window.scrollBy(0, 500));
      await sleep(2000);

      const joinButtonsCount = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('div[role="button"], span, button'));
        let clicked = 0;
        for (const b of btns) {
          const txt = (b.innerText || '').trim();
          const aria = b.getAttribute('aria-label') || '';
          if (
            (txt === 'Join' || txt === 'Join group' || txt === 'যোগ দিন' || txt === 'গ্রুপে যোগ দিন' || aria.includes('Join group') || aria.includes('গ্রুপে যোগ দিন')) &&
            !txt.includes('Joined') && !txt.includes('যোগ দিয়েছেন')
          ) {
            b.click();
            clicked++;
            if (clicked >= 3) break;
          }
        }
        return clicked;
      });

      console.log(`✓ "${kw}" থেকে ${joinButtonsCount} টি গ্রুপে অটো জয়েন রিকোয়েস্ট পাঠানো হয়েছে!`);
      await sleep(3000);

      await page.evaluate(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => { if (!cb.checked) cb.click(); });
        const subBtns = Array.from(document.querySelectorAll('div[aria-label="Submit"], div[aria-label="জমা দিন"], div[role="button"]'));
        for (const sb of subBtns) {
          const st = (sb.innerText || '').trim();
          if (st === 'Submit' || st === 'জমা দিন' || st === 'I agree' || st === 'সম্মত') {
            sb.click();
            break;
          }
        }
      });
      await sleep(2000);

    } catch (e) {
      console.log(`⚠️ গ্রুপ জয়েন সার্চে সাময়িক ত্রুটি: ${e.message}`);
    }
  }
  console.log('✅ বাল্ক গ্রুপ জয়েন প্রক্রিয়া সম্পন্ন!\n');
}

// -------------------------------------------------------------
// MODULE 2: AUTO MESSENGER LEAD CONVERTER
// -------------------------------------------------------------
async function autoReplyMessenger(page) {
  try {
    console.log('\n📬 [মেসেঞ্জার অটো-ক্লোজার] নতুন ইনবক্স মেসেজ চেক করা হচ্ছে...');
    await page.goto('https://www.facebook.com/messages/', { waitUntil: 'networkidle2' });
    await sleep(4000);

    const hasUnread = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('div[role="row"], div[role="gridcell"], a[href*="/messages/t/"]'));
      for (const r of rows) {
        const isBold = window.getComputedStyle(r).fontWeight >= 700 || r.innerHTML.includes('unread') || r.getAttribute('aria-label')?.includes('unread') || r.getAttribute('aria-label')?.includes('অপাঠ্য');
        if (isBold) {
          r.click();
          return true;
        }
      }
      return false;
    });

    if (hasUnread) {
      console.log('💬 নতুন অপাঠ্য মেসেজ পাওয়া গেছে! কনভার্সন স্ক্রিপ্ট প্রস্তুত হচ্ছে...');
      await sleep(3000);

      const freshLink = await getDynamicPromoLink(Date.now());
      const replyText = generateLeadReply(freshLink);

      const msgInput = await page.$('div[role="textbox"]');
      if (msgInput) {
        await msgInput.click();
        await sleep(1000);
        await page.evaluate((text) => {
          document.execCommand('insertText', false, text);
        }, replyText);
        await sleep(1500);
        await page.keyboard.press('Enter');
        console.log(`✅ [মেসেঞ্জার অটো-রিপ্লাই] মেম্বারকে সম্পূর্ণ ফ্রেশ লিংক (${freshLink}) সহ ৩০০৳ বোনাস ও WhatsApp কানেক্ট করার মেসেজ পাঠানো হয়েছে!`);
        await sleep(3000);
      }
    } else {
      console.log('✓ কোনো নতুন অপাঠ্য মেসেজ নেই।');
    }
  } catch (err) {
    console.log(`⚠️ মেসেঞ্জার চেক এড়ানো হলো: ${err.message}`);
  }
}

// -------------------------------------------------------------
// MODULE 3: AUTO COMMENT & NOTIFICATION RESPONDER
// -------------------------------------------------------------
async function autoReplyNotifications(page) {
  try {
    console.log('🔔 [নোটিফিকেশন ও কমেন্ট স্ক্যানার] পোস্টে আসা নতুন কমেন্ট চেক করা হচ্ছে...');
    await page.goto('https://www.facebook.com/notifications/', { waitUntil: 'networkidle2' });
    await sleep(4000);

    const commentNotifFound = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="comment_id"], a[href*="notif_t=feedback"], div[role="row"] a'));
      for (const a of links) {
        const txt = (a.innerText || '').toLowerCase();
        if (txt.includes('commented') || txt.includes('মন্তব্য করেছেন') || txt.includes('reply') || txt.includes('রিপ্লাই')) {
          a.click();
          return true;
        }
      }
      return false;
    });

    if (commentNotifFound) {
      console.log('💬 পোস্টে আসা নতুন কমেন্ট পাওয়া গেছে! ওপেন করা হচ্ছে...');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
      await sleep(4000);

      const replyBtnClicked = await page.evaluate(() => {
        const replyButtons = Array.from(document.querySelectorAll('div[role="button"], span'));
        for (const rb of replyButtons) {
          const t = (rb.innerText || '').trim();
          if (t === 'Reply' || t === 'উত্তর দিন') {
            rb.click();
            return true;
          }
        }
        return false;
      });

      if (replyBtnClicked) {
        await sleep(2000);
        const freshCommentLink = await getDynamicPromoLink(Date.now() + 1);
        const commentReplyText = `ধন্যবাদ ভাই! আপনার অলস সিমের WhatsApp দিয়ে প্রতিদিন ৩০০-১০০০ টাকা ফ্রিতে ইনকাম করুন। ১ম কানেক্টে ১০৳ এবং ২ বন্ধুতে ৩০০৳ ক্যাশ! সরাসরি সাইট লিংক: ${freshCommentLink}`;

        const commentBox = await page.$('div[role="textbox"]');
        if (commentBox) {
          await commentBox.click();
          await sleep(500);
          await page.evaluate((text) => {
            document.execCommand('insertText', false, text);
          }, commentReplyText);
          await sleep(1500);
          await page.keyboard.press('Enter');
          console.log(`✅ [কমেন্ট অটো-রিপ্লাই] কমেন্টকারীকে ফ্রেশ লিংক (${freshCommentLink}) সহ স্বয়ংক্রিয় রিপ্লাই দেওয়া হয়েছে!`);
          await sleep(3000);
        }
      }
    } else {
      console.log('✓ নতুন কোনো কমেন্ট নোটিফিকেশন নেই।');
    }
  } catch (err) {
    console.log(`⚠️ কমেন্ট স্ক্যানার স্কিপ: ${err.message}`);
  }
}

async function startBot() {
  console.log('================================================================');
  console.log('🚀 EarnPulse ১০০% ফুল অটোমেটিক ফেসবুক পোস্টিং বট 🚀');
  console.log('================================================================');
  console.log('⚡ সিস্টেম শুরু হচ্ছে...');

  if (!fs.existsSync(CHROME_PATH)) {
    console.error('❌ ক্রোম ব্রাউজার পাওয়া যায়নি: ' + CHROME_PATH);
    process.exit(1);
  }

  // ক্রোম লঞ্চ করা (হেডলেস ছাড়া, যাতে ইউজার নিজে লগইন দেখতে পায়)
  console.log('🌐 গুগল ক্রোম চালু করা হচ্ছে...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    userDataDir: USER_DATA_DIR,
    headless: false,
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--disable-notifications',
      '--disable-infobars'
    ]
  });

  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();

  console.log('🔍 ফেসবুক লোড করা হচ্ছে...');
  await page.goto('https://www.facebook.com', { waitUntil: 'networkidle2' });

  // চেক করা ইউজার ইতিমধ্যে লগইন আছে কিনা
  await sleep(3000);
  let cookies = await page.cookies();
  let isLoggedIn = cookies.some(c => c.name === 'c_user');

  if (!isLoggedIn) {
    console.log('\n----------------------------------------------------------------');
    console.log('⚠️  আপনি এখনো ফেসবুকে লগইন করেননি!');
    console.log('👉 খুলে যাওয়া ক্রোম ব্রাউজারে আপনার ফেসবুক আইডি ও পাসওয়ার্ড দিয়ে লগইন করুন।');
    console.log('👉 লগইন সম্পন্ন হয়ে ফেসবুকের হোমপেইজ আসলে এখানে এসে ENTER চাপুন।');
    console.log('----------------------------------------------------------------\n');
    await promptUser('লগইন করার পর ENTER চাপুন: ');

    cookies = await page.cookies();
    isLoggedIn = cookies.some(c => c.name === 'c_user');
    if (!isLoggedIn) {
      console.log('⚠️ লগইন শনাক্ত হয়নি, তবুও প্রক্রিয়া চলমান রাখা হচ্ছে...');
    } else {
      console.log('✅ সফলভাবে ফেসবুক লগইন সম্পন্ন হয়েছে! (ভবিষ্যতের জন্য কুকি সেভ করা হলো)');
    }
  } else {
    console.log('✅ পূর্বের সেভ করা ফেসবুক লগইন সেশন সক্রিয় আছে!');
  }

  console.log('\n🎯 মোট টার্গেট গ্রুপ সংখ্যা: ' + TARGET_GROUPS.length);
  console.log('🚀 ২৪/৭ নন-স্টপ অটো-পোস্টিং, অটো-জয়েন ও অটো-রিপ্লাই ইঞ্জিন প্রস্তুত!');
  console.log('⚡ আপনি যতক্ষণ এই উইন্ডো চালু রাখবেন, বট একা নিজেই সব কিছু স্বয়ংক্রিয়ভাবে করতে থাকবে!\n');

  // ধাপ ১: বট প্রথমে স্বয়ংক্রিয়ভাবে সেরা ইনকাম গ্রুপগুলো খুঁজে অটো-জয়েন করবে
  await autoJoinSearchedGroups(page);

  let round = 1;
  let totalOverallPosts = 0;

  while (true) {
    console.log(`\n============================================================`);
    console.log(`🚀 [রাউন্ড #${round}] অটো-পোস্টিং সাইকেল শুরু হচ্ছে...`);
    console.log(`============================================================\n`);

    // প্রতি রাউন্ডে মেসেঞ্জার ও কমেন্টে আসা লিডগুলোকে আগে অটো-রিপ্লাই দিয়ে কনভার্ট করা হবে
    await autoReplyMessenger(page);
    await autoReplyNotifications(page);

    // প্রতি রাউন্ডে গ্রুপগুলো এলোমেলোভাবে সাজানো হবে যাতে ন্যাচারাল হিউম্যান প্যাটার্ন বজায় থাকে
    const shuffledGroups = [...TARGET_GROUPS].sort(() => 0.5 - Math.random());
    let roundSuccess = 0;
    let roundFail = 0;

    for (let i = 0; i < shuffledGroups.length; i++) {
      const target = shuffledGroups[i];
      const promoLink = await getDynamicPromoLink(totalOverallPosts + i);
      const postText = generateUnlimitedPost(promoLink);

      console.log(`\n------------------------------------------------------------`);
      console.log(`📍 [রাউন্ড ${round} • গ্রুপ ${i + 1}/${shuffledGroups.length}] টার্গেট: "${target.name}"`);
      console.log(`🔗 এই পোস্টের ইউনিক লিংক: ${promoLink}`);
      console.log(`🔎 গ্রুপ সার্চ পেজে প্রবেশ করা হচ্ছে...`);

      try {
        // গ্রুপ সার্চ পেজে যাওয়া
        const searchUrl = `https://www.facebook.com/search/groups/?q=${encodeURIComponent(target.query)}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2' });
        await sleep(4000);

        // প্রথম গ্রুপের লিংকে ক্লিক করা
        console.log('🔗 গ্রুপের ভেতরে প্রবেশ করা হচ্ছে...');
        const groupLinkFound = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href*="/groups/"]'));
          for (const a of links) {
            const href = a.getAttribute('href') || '';
            if (href.includes('/groups/') && !href.includes('/search/') && !href.includes('/create/')) {
              a.click();
              return true;
            }
          }
          return false;
        });

        if (!groupLinkFound) {
          console.log('⚠️ গ্রুপের সরাসরি লিংক পাওয়া যায়নি, পরবর্তী গ্রুপে যাওয়া হচ্ছে...');
          roundFail++;
          continue;
        }

        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
        await sleep(4000);

        // পেজ স্ক্রোল ডাউন যাতে পোস্ট বক্স লোড হয়
        await page.evaluate(() => window.scrollBy(0, 300));
        await sleep(2000);

        // পোস্ট বক্স খোঁজা ও ক্লিক করা (Write something... / কিছু লিখুন...)
        console.log('✍️ পোস্ট ক্রিয়েট বক্স খোঁজা হচ্ছে...');
        let openedPostModal = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('div[role="button"], span, div'));
          for (const el of elements) {
            const txt = (el.innerText || '').trim();
            const aria = el.getAttribute('aria-label') || '';
            if (
              txt.includes('Write something...') || 
              txt.includes('কিছু লিখুন...') || 
              txt.includes('কী ভাবছেন?') || 
              txt.includes("What's on your mind?") ||
              aria.includes('Create a post') || 
              aria.includes('পোস্ট তৈরি করুন')
            ) {
              el.click();
              return true;
            }
          }
          return false;
        });

        // যদি পোস্ট বক্স না পাওয়া যায় (তার মানে এখনও গ্রুপে জয়েন করা হয়নি)
        if (!openedPostModal) {
          console.log('🔍 পোস্ট বক্স পাওয়া যায়নি, "Join Group" বাটন খোঁজা হচ্ছে...');
          const joinedClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('div[role="button"], span, a, button'));
            for (const b of buttons) {
              const txt = (b.innerText || '').trim();
              const aria = b.getAttribute('aria-label') || '';
              if (
                txt === 'Join group' || txt === 'Join Group' || txt === 'গ্রুপে যোগ দিন' || txt === 'যোগ দিন' ||
                aria.includes('Join group') || aria.includes('গ্রুপে যোগ দিন')
              ) {
                b.click();
                return true;
              }
            }
            return false;
          });

          if (joinedClicked) {
            console.log('👥 [অটো-জয়েন] এই গ্রুপে আপনি মেম্বার ছিলেন না — বট নিজে থেকেই "Join Group" বাটনে ক্লিক করেছে!');
            await sleep(3000);
            
            // রুলস বা সম্মতি সাবমিট করার চেষ্টা
            await page.evaluate(() => {
              const checkboxes = document.querySelectorAll('input[type="checkbox"]');
              checkboxes.forEach(cb => { if (!cb.checked) cb.click(); });
              const submitBtns = Array.from(document.querySelectorAll('div[aria-label="Submit"], div[aria-label="জমা দিন"], div[role="button"]'));
              for (const sb of submitBtns) {
                const stxt = (sb.innerText || '').trim();
                if (stxt === 'Submit' || stxt === 'জমা দিন' || stxt === 'I agree' || stxt === 'সম্মত') {
                  sb.click();
                  break;
                }
              }
            });
            await sleep(2500);

            // জয়েন হওয়ার পর আবার পোস্ট বক্স খোঁজা (পাবলিক গ্রুপগুলোতে তাৎক্ষণিক পোস্ট করা যায়)
            console.log('🔄 জয়েন শেষে পুনরায় পোস্ট বক্স খোঁজা হচ্ছে...');
            openedPostModal = await page.evaluate(() => {
              const elements = Array.from(document.querySelectorAll('div[role="button"], span, div'));
              for (const el of elements) {
                const txt = (el.innerText || '').trim();
                const aria = el.getAttribute('aria-label') || '';
                if (
                  txt.includes('Write something...') || 
                  txt.includes('কিছু লিখুন...') || 
                  txt.includes('কী ভাবছেন?') || 
                  txt.includes("What's on your mind?") ||
                  aria.includes('Create a post') || 
                  aria.includes('পোস্ট তৈরি করুন')
                ) {
                  el.click();
                  return true;
                }
              }
              return false;
            });
          }
        }

        if (!openedPostModal) {
          console.log('⏳ এই গ্রুপে এডমিন পেন্ডিং/রিভিউ প্রয়োজন (জয়েন রিকোয়েস্ট পাঠানো হয়েছে)। পরবর্তী গ্রুপে যাওয়া হচ্ছে...');
          roundFail++;
          continue;
        }

        await sleep(3000);

        // পোস্টের ছবি আপলোড করা (যদি ব্যানার থাকে)
        if (fs.existsSync(BANNER_PATH)) {
          console.log('🖼️ ব্যানার ছবি আপলোড করা হচ্ছে...');
          const fileInput = await page.$('input[type="file"][accept*="image"]');
          if (fileInput) {
            await fileInput.uploadFile(BANNER_PATH);
            await sleep(3000);
          } else {
            await page.evaluate(() => {
              const btns = Array.from(document.querySelectorAll('div[aria-label*="Photo"], div[aria-label*="ছবি"], div[aria-label*="photo/video"]'));
              if (btns.length > 0) btns[0].click();
            });
            await sleep(2000);
            const fInput2 = await page.$('input[type="file"][accept*="image"]');
            if (fInput2) {
              await fInput2.uploadFile(BANNER_PATH);
              await sleep(3000);
            }
          }
        }

        // টেক্সট টাইপ করা
        console.log('📝 আকর্ষণীয় অ্যান্টি-ব্যান লেখা ইনপুট দেওয়া হচ্ছে...');
        const textBox = await page.$('div[role="textbox"][contenteditable="true"]');
        if (textBox) {
          await textBox.click();
          await sleep(1000);
          await page.evaluate((text) => {
            document.execCommand('insertText', false, text);
          }, postText);
        } else {
          await page.keyboard.type(postText, { delay: 10 });
        }

        await sleep(3000);

        // "পোস্ট" বা "Post" বাটনে ক্লিক করা
        console.log('🚀 "Post" বাটনে ক্লিক করা হচ্ছে...');
        const posted = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('div[aria-label="Post"], div[aria-label="পোস্ট করুন"], div[aria-label="পোস্ট"], div[role="button"]'));
          for (const b of buttons) {
            const txt = (b.innerText || '').trim();
            const aria = b.getAttribute('aria-label') || '';
            if (
              (txt === 'Post' || txt === 'পোস্ট' || txt === 'পোস্ট করুন' || aria === 'Post' || aria === 'পোস্ট') &&
              b.getAttribute('aria-disabled') !== 'true'
            ) {
              b.click();
              return true;
            }
          }
          return false;
        });

        if (posted) {
          console.log(`✅ [সফল] "${target.name}" গ্রুপে পোস্ট সফলভাবে সম্পন্ন হয়েছে!`);
          roundSuccess++;
        } else {
          console.log(`⚠️ পোস্ট বাটন নিশ্চিত করা যায়নি (হয়তো এডমিন রিভিউ অথবা প্রিভিউ চলছে)`);
          roundFail++;
        }

      } catch (err) {
        console.error(`❌ গ্রুপ পোস্টিং ত্রুটি: ${err.message}`);
        roundFail++;
      }

      // প্রতি ৫টি গ্রুপ পর পর মেসেঞ্জার ও কমেন্টে কোনো আগ্রহী মেম্বারের মেসেজ আছে কিনা চেক করে ফ্রেশ লিংক দিয়ে অটো রিপ্লাই দেওয়া
      if ((i + 1) % 5 === 0) {
        console.log('\n🔄 [লিড চেক] গ্রুপ পোস্টিংয়ের ফাঁকে নতুন মেসেঞ্জার ও কমেন্ট চেক করা হচ্ছে...');
        await autoReplyMessenger(page);
        await autoReplyNotifications(page);
        console.log('✓ লিড চেক সম্পন্ন! পরবর্তী গ্রুপে পোস্টিং অব্যাহত রয়েছে...\n');
      }

      // প্রতিটি গ্রুপের মাঝে মানুষের মতো নিরাপদ ন্যাচারাল বিরতি (Anti-Ban Rate Limit Protection)
      const delaySec = Math.floor(Math.random() * 25) + 45; // ৪৫ থেকে ৭০ সেকেন্ড
      console.log(`⏳ ফেসবুক অ্যান্টি-ব্যান সুরক্ষা: পরবর্তী গ্রুপের আগে ${delaySec} সেকেন্ড বিরতি...`);
      await sleep(delaySec * 1000);
    }

    totalOverallPosts += roundSuccess;
    console.log(`\n============================================================`);
    console.log(`🏁 [রাউন্ড #${round} সম্পন্ন!]`);
    console.log(`🎉 এই রাউন্ডে সফল: ${roundSuccess} টি | সর্বমোট সফল পোস্ট: ${totalOverallPosts} টি`);
    console.log(`☕ ফেসবুক অ্যাকাউন্ট সেফটি কুলডাউন: পরবর্তী রাউন্ড শুরুর আগে ৭ মিনিট বিশ্রাম...`);
    console.log(`⚡ আপনি যতক্ষণ টুলস অন রাখবেন, বট একা নিজেই চব্বিশ ঘণ্টা পোস্ট করতে থাকবে!`);
    console.log(`============================================================\n`);

    // কুলডাউনের সময় মেসেঞ্জার ও নোটিফিকেশনে আসা লিড হ্যান্ডেল করা
    await autoReplyMessenger(page);
    await autoReplyNotifications(page);

    round++;
    await sleep(7 * 60 * 1000); // 7 minutes resting cooldown before next round
  }
}

startBot().catch(err => {
  console.error('Fatal bot error:', err);
});
