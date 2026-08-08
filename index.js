const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const TelegramBotApi = require("node-telegram-bot-api");
const TelegramBot = TelegramBotApi.default || TelegramBotApi;

const global = require("./config.js");
const axios = require("axios");
const chalk = require("chalk");
const amprem = require("amprem");

const bot = new TelegramBot(global.botToken, { polling: true });

const CHANNELS = ["@aboutvin7x", "@vinzxcommnty"];
const IMAGE_URL = "https://g.top4top.io/p_3871xq4od1.jpg";

const DB_PATH = path.join(__dirname, "database.json");
const USERS_PATH = path.join(__dirname, "users.json");
const MAINTENANCE_PATH = path.join(__dirname, "maintenance.json");

let db = {};
let usersList = [];
let maintenance = { status: "off" };
const userState = {};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const mainOwnerIds = Array.isArray(global.ownerId)
  ? global.ownerId
  : global.ownerId
  ? [global.ownerId]
  : [];

function isMainOwner(senderId) {
  return mainOwnerIds.includes(senderId);
}

function loadDatabase() {
  try {
    if (fs.existsSync(DB_PATH)) {
      db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    } else {
      db = { sessions: {} };
      saveDatabase();
    }
  } catch (error) {
    console.error("Error loading database:", error);
    db = { sessions: {} };
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error("Error saving database:", error);
  }
}

function loadUsersDatabase() {
  try {
    if (fs.existsSync(USERS_PATH)) {
      usersList = JSON.parse(fs.readFileSync(USERS_PATH, "utf8"));
    } else {
      usersList = [];
      saveUsersDatabase();
    }
  } catch (error) {
    console.error("Error loading users database:", error);
    usersList = [];
  }
}

function saveUsersDatabase() {
  try {
    fs.writeFileSync(USERS_PATH, JSON.stringify(usersList, null, 2));
  } catch (error) {
    console.error("Error saving users database:", error);
  }
}

function loadMaintenanceDatabase() {
  try {
    if (fs.existsSync(MAINTENANCE_PATH)) {
      maintenance = JSON.parse(fs.readFileSync(MAINTENANCE_PATH, "utf8"));
    } else {
      maintenance = { status: "off" };
      saveMaintenanceDatabase();
    }
  } catch (error) {
    console.error("Error loading maintenance database:", error);
    maintenance = { status: "off" };
  }
}

function saveMaintenanceDatabase() {
  try {
    fs.writeFileSync(MAINTENANCE_PATH, JSON.stringify(maintenance, null, 2));
  } catch (error) {
    console.error("Error saving maintenance database:", error);
  }
}

function registerUser(userId) {
  if (!usersList.includes(userId)) {
    usersList.push(userId);
    saveUsersDatabase();
  }
}

loadDatabase();
loadUsersDatabase();
loadMaintenanceDatabase();

async function createTempmail() {
  const allowedDomains = ["ozsaip.com", "bwmyga.com", "yzcalo.com", "lnovic.com"];
  while (true) {
    try {
      const res = await axios.get("https://creatett-seven.vercel.app/api/tempmail/create");
      const data = res.data;
      const domain = data.email.split("@")[1];
      if (allowedDomains.includes(domain)) {
        return data;
      }
    } catch (e) {
    }
    await sleep(1500);
  }
}

async function runAutoTempmailProcess() {
  const tempData = await createTempmail();
  const tempEmail = tempData.email;

  const sendRes = await amprem.sendLink(tempEmail);
  if (!sendRes?.success) {
    throw new Error(sendRes?.message || "Gagal mengirim link verifikasi AM.");
  }

  let magicLink = "";
  for (let i = 1; i <= 36; i++) {
    try {
      const inboxRes = await axios.get(`https://creatett-seven.vercel.app/api/tempmail/inbox/${tempEmail}?t=${Date.now()}`);
      if (inboxRes.data && inboxRes.data.length > 0) {
        const emailBody = JSON.stringify(inboxRes.data[0]);
        const regex = /https:\/\/alight-creative\.firebaseapp\.com[^\s"']+/;
        const match = emailBody.match(regex);
        if (match) {
          magicLink = match[0].replace(/\\/g, "");
          break;
        }
      }
    } catch (e) {}
    await sleep(5000);
  }

  if (!magicLink) {
    throw new Error("Timeout: Email verifikasi tidak masuk ke tempmail.");
  }

  await sleep(3000);

  const verifRes = await amprem.verifyLink(tempEmail, magicLink);
  if (!verifRes?.success) {
    throw new Error(verifRes?.message || "Gagal verifikasi Magic Link.");
  }

  const expiryMs = verifRes.premium?.data?.result?.expiryTimeMillis;
  const expiryDate = expiryMs
    ? new Date(Number(expiryMs)).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
      })
    : "Aktif (Permanent)";

  db.sessions[tempEmail] = {
    email: tempEmail,
    verifiedAt: new Date().toISOString(),
    status: "verified",
    link: magicLink
  };
  saveDatabase();

  return {
    email: tempEmail,
    status: "Premium ✨",
    expired: expiryDate,
    magicLink: magicLink
  };
}

async function isChannelMember(userId) {
  for (const channel of CHANNELS) {
    try {
      const member = await bot.getChatMember(channel, userId);
      const isOk = ["member", "administrator", "creator"].includes(member.status);
      if (!isOk) return false;
    } catch (error) {
      console.log(`Channel check error (${channel}):`, error.message);
      return false;
    }
  }
  return true;
}

function startBot() {
  const steps = 20;
  let progress = 0;

  const interval = setInterval(() => {
    const percent = Math.floor((progress / steps) * 100);
    const filled = "▓".repeat(progress);
    const empty = "░".repeat(steps - progress);

    let color;
    if (percent < 30) color = chalk.greenBright;
    else if (percent < 60) color = chalk.yellowBright;
    else if (percent < 90) color = chalk.magentaBright;
    else color = chalk.redBright;

    console.clear();
    console.log(chalk.bold("🔄 Memulai Bot Telegram...\n"));
    console.log(color(`${filled}${empty} ${percent}%`));

    progress++;

    if (progress > steps) {
      clearInterval(interval);
      console.clear();
      console.log(
        chalk.green(`
⣿⣿⣿⣿⣿⣷⣿⣿⣿⡅⡹⢿⠆⠙⠋⠉⠻⠿⣿⣿⣿⣿⣿⣿⣮⠻⣦⡙⢷⡑⠘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣌⠡⠌⠂⣙⠻⣛⠻⠷⠐⠈⠛⢱⣮⣷⣽⣿
⣿⣿⣿⣿⡇⢿⢹⣿⣶⠐⠁⠀⣀⣠⣤⠄⠀⠀⠈⠙⠻⣿⣿⣿⣦⣵⣌⠻⣷⢝⠦⠚⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢟⣻⣿⣊⡃⠀⣙⠿⣿⣿⣿⣎⢮⡀⢮⣽⣿⣿
⢿⣿⣿⣿⣧⡸⡎⡛⡩⠖⠀⣴⣿⣿⣿⠀⠀⠀⠀⠸⠇⠀⠙⢿⣿⣿⣿⣷⣌⢷⣑⢷⣄⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⣫⠶⠛⠉⠀⠁⠀⠈⠈⠀⠠⠜⠻⣿⣆⢿⣼⣿⣿⣿
⣿⣿⣿⣿⣧⢧⣧⢻⣦⢀⣹⣿⣿⣿⣇⠀⠄⠀⠀⠀⡀⠀⠈⢻⣿⣿⣿⣿⣷⣝⢦⡹⠷⡙⢿⣿⣿⣿⣿⣿⣿⣿⣿⠈⠁⠀⠀⠀⠁⠀⠀⠀⠱⣶⣄⡀⠀⠈⠛⠜⣿⣿⣿⣿
⠀⠊⢫⣿⣏⣿⡌⣼⣄⢫⡌⣿⣿⣿⣿⣿⣦⡈⠲⣄⣤⣤⡡⢀⣠⣿⣿⣿⣿⣿⣿⣷⣼⣍⢬⣦⡙⣿⣿⣿⣿⣿⣯⢁⡄⠀⡀⡀⠀⠄⢈⣠⢪⠀⣿⣿⣿⣦⠀⢉⢂⠹⡿⣿⣿
⠀⠀⠄⢹⢃⢻⣟⠙⣿⣦⠱⢻⣿⣿⣿⣿⣿⣿⣷⣬⣍⣭⣥⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⡙⢿⣼⡿⣿⣿⣿⣿⣿⣷⣄⠘⣱⢦⣤⡴⡿⢈⣼⣿⣿⣿⣇⣴⣶⣮⣅⢻⣿⡏
⠀⠀⠈⠹⣇⢡⢿⡆⠻⣿⣷⠀⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣍⡻⣿⣟⣻⣿⣿⣿⣿⣷⣦⣥⣬⣤⣴⣾⣿⣿⣿⣿⣷⣿⣿⣿⣿⣷⡜⠃
⠀⠀⠀⢀⣘⠈⢂⠃⣧⡹⣿⣷⡄⠙⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣮⣅⡙⢿⣟⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠋⡕⠂
⠀⠀⠀⠀⠀⠀⠛⢷⣜⢷⡌⠻⣿⣿⣦⣝⣻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣯⣹⣷⣦⣹⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠉⠃⠀

┌──────────────────────────────────────────────────┐
│ DEVELOPER   : t.me/yat1mlau                      │
│ INFORMATION : @aboutvin7x                        │
│ VERSION     : 1.0 (AM Premium Activator)         │
└──────────────────────────────────────────────────┘
            ✨ Bot Running Successfully ✨
        `)
      );
    }
  }, 150);
}

async function deleteMessage(chatId, messageId) {
  try {
    await bot.deleteMessage(chatId, messageId);
  } catch (e) {
  }
}

async function sendRichMessage(chatId, htmlContent, replyMarkup = null) {
  try {
    const payload = {
      chat_id: chatId,
      rich_message: {
        html: htmlContent
      }
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    await axios.post(`https://api.telegram.org/bot${global.botToken}/sendRichMessage`, payload);
  } catch (e) {
    console.error("Gagal sendRichMessage:", e.response?.data || e.message);
    await bot.sendMessage(chatId, htmlContent, { parse_mode: "HTML", reply_markup: replyMarkup });
  }
}

async function checkMaintenance(chatId, senderId) {
  if (maintenance.status === "on" && !isMainOwner(senderId)) {
    const timeNow = new Date().toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Jakarta"
    });

    const text = `<h2>BOT SEDANG MAINTENANCE</h2>

<table bordered striped>
  <tr><th>Info</th><th>Detail</th></tr>
  <tr><td>Status</td><td>🔴 Maintenance</td></tr>
  <tr><td>Waktu Server</td><td>${timeNow} WIB</td></tr>
  <tr><td>Aktivasi AM</td><td>Nonaktif Sementara</td></tr>
</table>

<aside>
  Bot sedang dalam peningkatan performa & pemeliharaan sistem. Semua fitur aktivasi di-nonaktifkan sementara waktu hingga proses perbaikan selesai.
</aside>

<footer>© Since 2026 - <a href="https://t.me/yat1mlau">t.me/yat1mlau</a></footer>`;

    const buttons = {
      inline_keyboard: [
        [
          { text: "Hubungi Admin", url: "https://t.me/yat1mlau", style: "primary" }
        ]
      ]
    };

    await sendRichMessage(chatId, text, buttons);
    return true;
  }
  return false;
}

function getMainMenuText(msgFrom) {
  const username = msgFrom.username ? `@${msgFrom.username}` : "-";
  const nickname = [msgFrom.first_name, msgFrom.last_name].filter(Boolean).join(" ") || "User";
  const id = String(msgFrom.id);
  const status = isMainOwner(msgFrom.id) ? "Owner" : "User";

  return `<tg-collage>
  <img src="${IMAGE_URL}"/>
</tg-collage>

<h2>✨ Alight Motion Premium Activator ✨</h2>
<p>Selamat datang di Bot Aktivasi Alight Motion Premium! Bot ini siap membantu kamu mengaktifkan fitur premium akun Alight Motion secara cepat, otomatis, praktis, dan gratis.</p>

<hr/>
<h3>🤖 BOT INFORMATION</h3>
<table bordered striped>
  <tr><th>Information</th><th>Value</th></tr>
  <tr><td>Author</td><td>t.me/yat1mlau</td></tr>
  <tr><td>Version</td><td>1.0</td></tr>
  <tr><td>Library</td><td>node-telegram-bot-api</td></tr>
  <tr><td>Language</td><td>JavaScript</td></tr>
  <tr><td>Node</td><td>${process.version}</td></tr>
</table>

<h3>👤 USER INFORMATION</h3>
<table bordered striped>
  <tr><th>Information</th><th>Detail</th></tr>
  <tr><td>Nickname</td><td>${nickname}</td></tr>
  <tr><td>Username</td><td>${username}</td></tr>
  <tr><td>ID</td><td>${id}</td></tr>
  <tr><td>Status</td><td>${status}</td></tr>
</table>

<hr/>
<footer>© Since 2026 - <a href="https://t.me/yat1mlau">t.me/yat1mlau</a></footer>`;
}

function getMainMenuButtons() {
  return {
    inline_keyboard: [
      [
        { text: "「 ➕ 」Create AM", callback_data: "am_create_options", style: "primary" },
        { text: "「 📊 」AM Menu", callback_data: "am_menu", style: "primary" }
      ],
      [
        { text: "「 📢 」Channel", url: "https://t.me/aboutvin7x", style: "danger" }
      ]
    ]
  };
}

function getAllFiles(dirPath, arrayOfFiles = [], ignoreList = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    const relativePath = path.relative(__dirname, fullPath).replace(/\\/g, "/");

    if (ignoreList.some((ignore) => relativePath.startsWith(ignore) || file === ignore)) {
      return;
    }

    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles, ignoreList);
    } else {
      arrayOfFiles.push({
        fullPath: fullPath,
        relativePath: relativePath
      });
    }
  });

  return arrayOfFiles;
}

bot.onText(/\/update/, async (msg) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;

  if (!isMainOwner(senderId)) {
    return sendRichMessage(chatId, "<h3>❌ Akses Ditolak</h3><p>Perintah ini hanya dapat digunakan oleh Owner!</p>");
  }

  const statusText = `<h2>⏳ SINKRONISASI REPOSITORY GITHUB</h2>
<p>Sedang memeriksa & menarik update terbaru dari GitHub...</p>`;
  await sendRichMessage(chatId, statusText);

  exec("git fetch --all && git reset --hard origin/main", async (error, stdout, stderr) => {
    if (error) {
      return sendRichMessage(chatId, `<h3>❌ Gagal Auto-Update!</h3><pre>${error.message}</pre>`);
    }

    const successText = `<h2>🔄 Update Berhasil Ditarik!</h2>
<pre>${stdout}</pre>
<hr/>
<p>Bot akan otomatis merestart dalam 3 detik...</p>`;

    await sendRichMessage(chatId, successText);

    setTimeout(() => {
      exec("pm2 restart amprem");
    }, 3000);
  });
});

bot.onText(/\/maintenance(?:\s+(on|off))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const option = match[1] ? match[1].toLowerCase() : null;

  if (!isMainOwner(senderId)) {
    return sendRichMessage(chatId, "<h3>❌ Akses Ditolak</h3><p>Perintah ini hanya dapat digunakan oleh Owner!</p>");
  }

  if (!option || !["on", "off"].includes(option)) {
    const text = `<h3>⚙️ FITUR MAINTENANCE</h3>
<p>Status saat ini: <b>${maintenance.status.toUpperCase()}</b></p>
<hr/>
<p>Gunakan perintah:</p>
<pre>/maintenance on  - Aktifkan maintenance & Auto-Broadcast</pre>
<pre>/maintenance off - Matikan maintenance & Auto-Broadcast</pre>`;
    return sendRichMessage(chatId, text);
  }

  maintenance.status = option;
  saveMaintenanceDatabase();

  const timeNow = new Date().toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta"
  });

  let broadcastText = "";
  let buttons = null;

  if (option === "on") {
    broadcastText = `<h2>BOT SEDANG MAINTENANCE</h2>

<table bordered striped>
  <tr><th>Info</th><th>Detail</th></tr>
  <tr><td>Status</td><td>🔴 Offline</td></tr>
  <tr><td>Waktu</td><td>${timeNow} WIB</td></tr>
  <tr><td>Aktivasi AM</td><td>Nonaktif Sementara</td></tr>
</table>

<aside>
  Bot sedang dalam peningkatan performa & pemeliharaan sistem. Fitur aktivasi di-nonaktifkan sementara waktu hingga perbaikan selesai.
</aside>

<footer>© Since 2026 - <a href="https://t.me/yat1mlau">t.me/yat1mlau</a></footer>`;

    buttons = {
      inline_keyboard: [
        [
          { text: "Hubungi Admin", url: "https://t.me/yat1mlau", style: "primary" }
        ]
      ]
    };
  } else {
    broadcastText = `<h2>BOT SEDANG AKTIF</h2>

<table bordered striped>
  <tr><th>Info</th><th>Detail</th></tr>
  <tr><td>Status</td><td>🟢 Online</td></tr>
  <tr><td>Waktu</td><td>${timeNow} WIB</td></tr>
  <tr><td>Aktivasi AM</td><td>Normal / Siap Digunakan</td></tr>
</table>

<aside>
  Bot sudah selesai dari Maintenance. Silakan gunakan bot kembali untuk mengaktifkan Alight Motion Premium kamu secara gratis!
</aside>

<footer>© Since 2026 - <a href="https://t.me/yat1mlau">t.me/yat1mlau</a></footer>`;

    buttons = {
      inline_keyboard: [
        [
          { text: "Hubungi Admin", url: "https://t.me/yat1mlau", style: "primary" }
        ]
      ]
    };
  }

  const noticeText = `<h2>⏳ PERUBAHAN MODE MAINTENANCE</h2>
<p>Mode maintenance diubah menjadi <b>${option.toUpperCase()}</b>. Memulai Auto-Broadcast ke ${usersList.length} user...</p>`;
  await sendRichMessage(chatId, noticeText);

  let successCount = 0;
  let failedCount = 0;

  for (const targetId of usersList) {
    try {
      await sendRichMessage(targetId, broadcastText, buttons);
      successCount++;
    } catch (e) {
      failedCount++;
    }
  }

  const reportText = `<h2>✅ Mode Maintenance Berhasil Diubah!</h2>

<table bordered striped>
  <tr><th>Field</th><th>Detail</th></tr>
  <tr><td>Status Mode</td><td><b>${option.toUpperCase()}</b></td></tr>
  <tr><td>Berhasil Dikirimi</td><td>${successCount} User</td></tr>
  <tr><td>Gagal Dikirimi</td><td>${failedCount} User</td></tr>
</table>

<hr/>
<footer>© Since 2026 - <a href="https://t.me/yat1mlau">t.me/yat1mlau</a></footer>`;

  await sendRichMessage(chatId, reportText);
});

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;

  registerUser(senderId);

  if (await checkMaintenance(chatId, senderId)) return;

  const isMember = await isChannelMember(senderId);

  if (!isMember) {
    const text = `<h2>⊰─「 Akses Dibatasi 」─⊱</h2>
<p>Wajib Follow kedua Channel di bawah ini untuk menggunakan bot!</p>

<hr/>
<footer>© Since 2026 - <a href="https://t.me/yat1mlau">t.me/yat1mlau</a></footer>`;

    return sendRichMessage(chatId, text, {
      inline_keyboard: [
        [
          { text: "📢 Join Channel 1", url: "https://t.me/aboutvin7x", style: "primary" },
          { text: "📢 Join Channel 2", url: "https://t.me/vinzxcommnty", style: "primary" }
        ],
        [{ text: "✅ Sudah Follow", callback_data: "check_follow", style: "success" }]
      ]
    });
  }

  const htmlText = getMainMenuText(msg.from);
  const buttons = getMainMenuButtons();

  await sendRichMessage(chatId, htmlText, buttons);
});

bot.onText(/\/(bc|broadcast)(?:\s+([\s\S]+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  
  let broadcastText = match[2] ? match[2].trim() : "";

  if (!isMainOwner(senderId)) {
    return sendRichMessage(chatId, "<h3>❌ Akses Ditolak</h3><p>Perintah ini hanya dapat digunakan oleh Owner!</p>");
  }

  let mediaFileId = null;
  let mediaType = null;

  if (msg.reply_to_message) {
    const replyMsg = msg.reply_to_message;

    if (!broadcastText && replyMsg.caption) {
      broadcastText = replyMsg.caption;
    }

    if (replyMsg.photo) {
      mediaFileId = replyMsg.photo[replyMsg.photo.length - 1].file_id;
      mediaType = "photo";
    } else if (replyMsg.video) {
      mediaFileId = replyMsg.video.file_id;
      mediaType = "video";
    }
  }

  if (!broadcastText) {
    const usageText = `<h3>📢 Format Broadcast Salah</h3>
<p>Gunakan perintah:</p>
<pre>/bc &lt;pesan&gt;</pre>
<p><i>Atau reply Foto/Video dengan perintah <code>/bc</code></i></p>`;
    return sendRichMessage(chatId, usageText);
  }

  if (usersList.length === 0) {
    return sendRichMessage(chatId, "<h3>📭 Database User Kosong</h3>");
  }

  const startBcText = `<h2>📢 PROSES BROADCAST</h2><p>Sedang memproses pengiriman pesan ke ${usersList.length} user...</p>`;
  await sendRichMessage(chatId, startBcText);

  let successCount = 0;
  let failedCount = 0;

  for (const targetId of usersList) {
    try {
      if (mediaType === "photo") {
        await bot.sendPhoto(targetId, mediaFileId, {
          caption: `📢 <b>BROADCAST ANNOUNCEMENT</b>\n\n${broadcastText}\n\n<i>© Powered by @yat1mlau</i>`,
          parse_mode: "HTML"
        });
      } else if (mediaType === "video") {
        await bot.sendVideo(targetId, mediaFileId, {
          caption: `📢 <b>BROADCAST ANNOUNCEMENT</b>\n\n${broadcastText}\n\n<i>© Powered by @yat1mlau</i>`,
          parse_mode: "HTML"
        });
      } else {
        const richHtml = `<h2>📢 BROADCAST ANNOUNCEMENT</h2>
<p>${broadcastText.replace(/\n/g, "<br/>")}</p>
<hr/>
<footer>© Message from Owner - <a href="https://t.me/yat1mlau">t.me/yat1mlau</a></footer>`;
        await sendRichMessage(targetId, richHtml);
      }
      successCount++;
    } catch (e) {
      failedCount++;
    }
  }

  const reportText = `<h2>✅ Broadcast Selesai!</h2>

<table bordered striped>
  <tr><th>Status</th><th>Jumlah</th></tr>
  <tr><td>Total User</td><td>${usersList.length}</td></tr>
  <tr><td>Berhasil</td><td>${successCount}</td></tr>
  <tr><td>Gagal</td><td>${failedCount}</td></tr>
</table>

<hr/>
<footer>© Since 2026 - <a href="https://t.me/yat1mlau">t.me/yat1mlau</a></footer>`;

  await sendRichMessage(chatId, reportText);
});

bot.onText(/\/backup(?:\s+([\s\S]+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const senderId = msg.from.id;
  const inputData = match[1];

  if (!isMainOwner(senderId)) {
    return sendRichMessage(chatId, "<h3>❌ Akses Ditolak</h3><p>Perintah ini hanya dapat digunakan oleh Owner!</p>");
  }

  if (!inputData || !inputData.includes("|")) {
    const usageText = `<h3>📌 Format Backup Salah</h3>
<p>Gunakan format perintah berikut:</p>
<pre>/backup token_github|username_github|nama_repo</pre>
<p>Contoh: <code>/backup ghp_xxxxxx|vinzephyrine|amprem</code></p>`;
    return sendRichMessage(chatId, usageText);
  }

  const parts = inputData.split("|");
  if (parts.length < 3) {
    const usageText = `<h3>📌 Format Backup Tidak Lengkap</h3>
<p>Harap masukkan 3 parameter yang dipisahkan garis lurus (<code>|</code>):</p>
<pre>/backup token_github|username_github|nama_repo</pre>`;
    return sendRichMessage(chatId, usageText);
  }

  const token = parts[0].trim();
  const owner = parts[1].trim();
  const repo = parts[2].trim();

  await deleteMessage(chatId, messageId);

  const startBackupText = `<h2>⏳ SINKRONISASI BACKUP GITHUB</h2><p>Memproses upload file utama ke repository GitHub...</p>`;
  await sendRichMessage(chatId, startBackupText);

  try {
    try {
      await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { Authorization: `token ${token}` }
      });
    } catch (e) {
      await axios.post(
        "https://api.github.com/user/repos",
        { name: repo, private: false, auto_init: false },
        {
          headers: {
            Authorization: `token ${token}`,
            "Content-Type": "application/json"
          }
        }
      );
    }

    const allowedFiles = [
      "config.js",
      "index.js",
      "package.json",
      "database.json",
      "users.json",
      "maintenance.json"
    ];

    const allFiles = getAllFiles(__dirname, [], ["node_modules", ".git", ".npm", ".npm-cache"]);
    const filesToBackup = allFiles.filter((fileItem) =>
      allowedFiles.includes(fileItem.relativePath)
    );

    let uploadedCount = 0;
    let failedCount = 0;

    for (const fileItem of filesToBackup) {
      try {
        const fileData = fs.readFileSync(fileItem.fullPath);
        const base64Content = fileData.toString("base64");
        const filePath = fileItem.relativePath;
        const encodedPath = filePath.split("/").map(v => encodeURIComponent(v)).join("/");
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

        let sha = null;
        try {
          const check = await axios.get(url, {
            headers: { Authorization: `token ${token}` }
          });
          sha = check.data.sha;
        } catch (error) {
        }

        await axios.put(
          url,
          {
            message: sha ? `Update ${filePath}` : `Add ${filePath}`,
            content: base64Content,
            sha: sha || undefined
          },
          {
            headers: {
              Authorization: `token ${token}`,
              "Content-Type": "application/json"
            }
          }
        );

        uploadedCount++;
      } catch (err) {
        failedCount++;
      }
    }

    const resultText = `<h2>✅ Backup ke GitHub Berhasil!</h2>

<table bordered striped>
  <tr><th>Field</th><th>Detail</th></tr>
  <tr><td>Repository</td><td><code>${owner}/${repo}</code></td></tr>
  <tr><td>File Ter-backup</td><td>${uploadedCount} dari ${allowedFiles.length} File Utama</td></tr>
  <tr><td>Gagal</td><td>${failedCount} File</td></tr>
  <tr><td>Link Repo</td><td><a href="https://github.com/${owner}/${repo}">Klik Di Sini</a></td></tr>
</table>

<hr/>
<footer>© Since 2026 - <a href="https://t.me/yat1mlau">t.me/yat1mlau</a></footer>`;

    await sendRichMessage(chatId, resultText);
  } catch (error) {
    console.error("Backup Error:", error.response?.data || error.message);
    await sendRichMessage(chatId, `<h3>❌ Backup Gagal!</h3><p>${error.response?.data?.message || error.message}</p>`);
  }
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const senderId = query.from.id;
  const action = query.data;

  if (await checkMaintenance(chatId, senderId)) {
    return bot.answerCallbackQuery(query.id, { text: "⚠️ Bot sedang maintenance!", show_alert: true });
  }

  try {
    if (action === "check_follow") {
      const isMember = await isChannelMember(senderId);
      if (!isMember) {
        return bot.answerCallbackQuery(query.id, { text: "❌ Kamu belum follow kedua channel!", show_alert: true });
      }

      await bot.answerCallbackQuery(query.id, { text: "✅ Selamat datang!" });
      await deleteMessage(chatId, messageId);

      const htmlText = getMainMenuText(query.from);
      const buttons = getMainMenuButtons();

      return sendRichMessage(chatId, htmlText, buttons);
    }

    if (action === "am_create_options") {
      await bot.answerCallbackQuery(query.id);
      await deleteMessage(chatId, messageId);

      const text = `<h2>✨ PILIH METODE CREATION ✨</h2>

<p>Pilih salah satu metode pembuatan akun Alight Motion Premium di bawah ini:</p>

<hr/>
<p><b>1. Temp-Mail (Otomatis):</b></p>
<p>Sistem akan membuat email sementara secara instan & verifikasi otomatis tanpa perlu memasukkan email pribadi.</p>

<p><b>2. Custom Gmail (Manual):</b></p>
<p>Gunakan email Gmail pribadi kamu. Kamu perlu memverifikasi dengan menempelkan link verifikasi yang dikirim ke inbox.</p>

<hr/>
<footer>© Since 2026 - <a href="https://t.me/yat1mlau">t.me/yat1mlau</a></footer>`;

      const buttons = {
        inline_keyboard: [
          [
            { text: "「 ✉️ 」 Temp-Mail", callback_data: "mode_tempmail", style: "primary" },
            { text: "「 📧 」 Custom Gmail", callback_data: "mode_custom_gmail", style: "primary" }
          ],
          [
            { text: "↺ Kembali", callback_data: "back_menu", style: "danger" }
          ]
        ]
      };

      return sendRichMessage(chatId, text, buttons);
    }

    if (action === "mode_custom_gmail") {
      userState[senderId] = { step: "wait_email" };
      await bot.answerCallbackQuery(query.id);
      await deleteMessage(chatId, messageId);

      const text = `<h3>📧 Masukkan Email Alight Motion</h3>
<p>Kirim email yang mau di-premiumkan di bawah ini.</p>

<pre>Contoh: email@gmail.com</pre>`;

      return sendRichMessage(chatId, text);
    }

    if (action === "mode_tempmail") {
      await bot.answerCallbackQuery(query.id);
      await deleteMessage(chatId, messageId);

      const text = `<h2>✉️ OPSI TEMP-MAIL CREATOR ✉️</h2>

<p>Pilih mode pembuatan Temp-Mail yang diinginkan:</p>

<hr/>
<p><b>1. Auto Temp-Mail (Single):</b></p>
<p>Membuat 1 akun Alight Motion Premium secara instan dalam sekali klik.</p>

<p><b>2. Bulk Temp-Mail (Masal):</b></p>
<p>Membuat banyak akun sekaligus (Maksimal 10 akun) secara otomatis dengan jeda aman 5 detik per akun.</p>

<hr/>
<footer>© Since 2026 - <a href="https://t.me/yat1mlau">t.me/yat1mlau</a></footer>`;

      const buttons = {
        inline_keyboard: [
          [
            { text: "「 ⚡ 」 Auto Temp-Mail", callback_data: "run_auto_tempmail", style: "success" },
            { text: "「 📦 」 Bulk Temp-Mail", callback_data: "input_bulk_count", style: "primary" }
          ],
          [
            { text: "↺ Kembali", callback_data: "am_create_options", style: "danger" }
          ]
        ]
      };

      return sendRichMessage(chatId, text, buttons);
    }

    if (action === "run_auto_tempmail") {
      await bot.answerCallbackQuery(query.id);
      await deleteMessage(chatId, messageId);

      const startAutoText = `<h2>⏳ PROSES AUTO TEMP-MAIL</h2>
<p>Sedang membuat email sementara & menunggu link verifikasi masuk ke inbox...</p>`;
      await sendRichMessage(chatId, startAutoText);

      try {
        const itemResult = await runAutoTempmailProcess();

        const richTableText = `<h2>🎉 Auto Temp-Mail Berhasil!</h2>

<table bordered striped>
  <tr><th>Field</th><th>Detail</th></tr>
  <tr><td>Email</td><td><code>${itemResult.email}</code></td></tr>
  <tr><td>Status</td><td>${itemResult.status}</td></tr>
  <tr><td>Expired</td><td>${itemResult.expired}</td></tr>
  <tr><td>Magic Link</td><td><code>${itemResult.magicLink}</code></td></tr>
</table>

<hr/>
<footer>© Since 2026 - <a href="https://t.me/yat1mlau">t.me/yat1mlau</a></footer>`;

        await sendRichMessage(chatId, richTableText);
      } catch (err) {
        const failText = `<h3>❌ Auto Temp-Mail Gagal</h3>
<p>${err.message}</p>`;
        await sendRichMessage(chatId, failText);
      }
      return;
    }

    if (action === "input_bulk_count") {
      userState[senderId] = { step: "wait_bulk_count" };
      await bot.answerCallbackQuery(query.id);
      await deleteMessage(chatId, messageId);

      const text = `<h3>⏳ BULK TEMPMAIL ACTIVATOR</h3>
<p>Masukkan jumlah akun Tempmail yang ingin dibuat otomatis!</p>
<hr/>
<pre>Maksimal: 10 Akun</pre>
<p>Kirimkan angka saja (Contoh: <b>5</b>)</p>`;

      return sendRichMessage(chatId, text);
    }

    if (action === "am_menu") {
      if (!isMainOwner(senderId)) {
        return bot.answerCallbackQuery(query.id, { text: "❌ Hanya Owner!", show_alert: true });
      }

      await bot.answerCallbackQuery(query.id);
      await deleteMessage(chatId, messageId);

      const sessions = Object.values(db.sessions);
      if (sessions.length === 0) {
        const text = `<h3>📭 Belum Ada Session</h3>
<p>Belum ada session Alight Motion yang terdaftar.</p>`;

        return sendRichMessage(chatId, text, {
          inline_keyboard: [[{ text: "↺ Kembali", callback_data: "back_menu", style: "danger" }]]
        });
      }

      let rowsHtml = "";
      sessions.forEach((s, i) => {
        rowsHtml += `<tr><td>${i + 1}</td><td>${s.email}</td><td>${s.verifiedAt ? "Verified" : "Pending"}</td></tr>`;
      });

      const text = `<h2>📋 DAFTAR SESSION ALIGHT</h2>

<table bordered striped>
  <tr><th>No</th><th>Email</th><th>Status</th></tr>
  ${rowsHtml}
</table>

<p>Total Session: ${sessions.length}</p>`;

      return sendRichMessage(chatId, text, {
        inline_keyboard: [[{ text: "↺ Kembali", callback_data: "back_menu", style: "danger" }]]
      });
    }

    if (action === "back_menu") {
      await bot.answerCallbackQuery(query.id);
      await deleteMessage(chatId, messageId);

      const htmlText = getMainMenuText(query.from);
      const buttons = getMainMenuButtons();

      return sendRichMessage(chatId, htmlText, buttons);
    }
  } catch (e) {
    console.error("Callback error:", e);
    bot.answerCallbackQuery(query.id, { text: "❌ Error!", show_alert: true });
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const text = msg.text;

  if (!text || text.startsWith("/")) return;

  if (await checkMaintenance(chatId, senderId)) return;

  const state = userState[senderId];
  if (!state) return;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (state.step === "wait_bulk_count") {
    const count = parseInt(text.trim(), 10);
    if (isNaN(count) || count < 1 || count > 10) {
      const errText = `<h3>❌ Jumlah Tidak Valid!</h3>
<p>Harap masukkan angka antara <b>1</b> sampai <b>10</b>!</p>`;
      return sendRichMessage(chatId, errText);
    }

    delete userState[senderId];

    const startBulkText = `<h2>⏳ MEMULAI PROSES BULK</h2>
<p>Target: <b>${count} Akun</b></p>
<p>Mohon tunggu, sistem otomatis sedang memproses seluruh akun...</p>`;
    await sendRichMessage(chatId, startBulkText);

    let successCount = 0;
    let failedCount = 0;
    let tablesHtml = "";

    for (let i = 1; i <= count; i++) {
      try {
        const itemResult = await runAutoTempmailProcess();
        successCount++;

        tablesHtml += `<h3>🎉 Akun ${i} dari ${count} Berhasil</h3>
<table bordered striped>
  <tr><th>Field</th><th>Detail</th></tr>
  <tr><td>Email</td><td><code>${itemResult.email}</code></td></tr>
  <tr><td>Status</td><td>${itemResult.status}</td></tr>
  <tr><td>Expired</td><td>${itemResult.expired}</td></tr>
  <tr><td>Magic Link</td><td><code>${itemResult.magicLink}</code></td></tr>
</table>
<br/>`;
      } catch (err) {
        failedCount++;
        tablesHtml += `<h3>❌ Akun ${i} dari ${count} Gagal</h3>
<p>Error: ${err.message}</p>
<hr/>`;
      }

      if (i < count) {
        await sleep(5000);
      }
    }

    const singleRichMessageText = `<h2>✅ HASIL BULK TEMPMAIL</h2>

<table bordered striped>
  <tr><th>Info</th><th>Detail</th></tr>
  <tr><td>Total</td><td>${count} Akun</td></tr>
  <tr><td>Berhasil</td><td>${successCount} Akun</td></tr>
  <tr><td>Gagal</td><td>${failedCount} Akun</td></tr>
</table>

<hr/>

${tablesHtml}

<footer>© Since 2026 - <a href="https://t.me/yat1mlau">t.me/yat1mlau</a></footer>`;

    await sendRichMessage(chatId, singleRichMessageText);
  }

  else if (state.step === "wait_email") {
    if (!emailRegex.test(text.trim())) {
      const errorText = `<h3>❌ Format Email Tidak Valid</h3>
<p>Silakan kirim email dengan format yang benar!</p>

<pre>Contoh: contoh@gmail.com</pre>`;
      return sendRichMessage(chatId, errorText);
    }

    const email = text.trim();
    userState[senderId].email = email;
    userState[senderId].step = "wait_link";

    bot.sendChatAction(chatId, "typing");

    try {
      const response = await amprem.sendLink(email);

      if (response?.success) {
        db.sessions[email] = {
          email: email,
          status: "pending",
          sentAt: new Date().toISOString(),
          verifiedAt: null,
          link: null
        };
        saveDatabase();

        const successText = `<h2>✅ Email Berhasil Dikirim!</h2>

<p>Email Target: <code>${email}</code></p>

<hr/>
<h3>📋 Langkah Selanjutnya:</h3>
<ol>
  <li>Cek email kamu (cek folder Spam jika ada)</li>
  <li>Klik tombol 'Log in to Alight Motion'</li>
  <li>Salin URL setelah di-redirect</li>
  <li>Kirimkan link URL tersebut di sini</li>
</ol>`;

        await sendRichMessage(chatId, successText);
      } else {
        throw new Error(response?.message || "Gagal mengirim link");
      }
    } catch (e) {
      console.error("Error AM Send:", e);
      delete userState[senderId];

      const failText = `<h3>❌ Gagal Mengirim Link</h3>
<p>${e.message}</p>`;
      await sendRichMessage(chatId, failText);
    }
  }

  else if (state.step === "wait_link") {
    const email = state.email;
    const link = text.trim();

    if (!link.startsWith("http")) {
      const invalidLinkText = `<h3>❌ Link Tidak Valid</h3>
<p>Link harus diawali dengan http:// atau https://</p>`;
      return sendRichMessage(chatId, invalidLinkText);
    }

    bot.sendChatAction(chatId, "typing");

    try {
      const response = await amprem.verifyLink(email, link);

      if (response?.success) {
        const userEmail = response.user?.email || email;
        const expiryMs = response.premium?.data?.result?.expiryTimeMillis;
        const expiryDate = expiryMs
          ? new Date(Number(expiryMs)).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })
          : 'Aktif (Permanent)';

        if (db.sessions[email]) {
          db.sessions[email].verifiedAt = new Date().toISOString();
          db.sessions[email].status = 'verified';
          db.sessions[email].link = link;
          saveDatabase();
        }

        const verifText = `<h2>🎉 Verifikasi Berhasil!</h2>

<table bordered striped>
  <tr><th>Field</th><th>Detail</th></tr>
  <tr><td>Email</td><td><code>${userEmail}</code></td></tr>
  <tr><td>Status</td><td>Premium ✨</td></tr>
  <tr><td>Expired</td><td>${expiryDate}</td></tr>
</table>

<hr/>
<p>Selamat! Alight Motion Premium berhasil diaktifkan!</p>

<footer>© Since 2026 - <a href="https://t.me/yat1mlau">t.me/yat1mlau</a></footer>`;

        await sendRichMessage(chatId, verifText);
        
        delete userState[senderId];
      } else {
        throw new Error(response?.message || "Gagal memverifikasi akun");
      }
    } catch (e) {
      console.error("Error AM Verif:", e);

      let errorMsg = e.message;
      if (e.message.includes('Email tidak valid')) {
        errorMsg = "Format email tidak valid!";
      } else if (e.message.includes('Magic Link')) {
        errorMsg = "Link tidak valid atau sudah expired!";
      } else if (e.message.includes('AES')) {
        errorMsg = "Server error - silakan coba lagi nanti.";
      }

      const failVerifText = `<h3>❌ Verifikasi Gagal</h3>
<p>${errorMsg}</p>
<p>Silakan coba lagi dengan mengirimkan link URL yang benar.</p>`;

      await sendRichMessage(chatId, failVerifText);
    }
  }
});

startBot();
