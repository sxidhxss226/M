// ===== SXIDHXSS MD WhatsApp Bot - Complete Single File =====
// For Render.com deployment

console.log('🚀 Starting VORTE PRO WhatsApp Bot...');

// ===== 1. EXPRESS SERVER SETUP =====
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>🤖 VORTE PRO</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        h1 { color: #4CAF50; }
        .status { background: #f5f5f5; padding: 20px; border-radius: 10px; display: inline-block; }
      </style>
    </head>
    <body>
      <div class="status">
        <h1>🤖 VORTE PRO</h1>
        <p>Status: <strong style="color: green;">● Running</strong></p>
        <p>Server time: ${new Date().toLocaleString()}</p>
        <p>Use /health for API health check</p>
      </div>
    </body>
    </html>
  `);
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'whatsapp-bot',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Keep-alive endpoint
app.get('/keep-alive', (req, res) => {
  res.status(200).json({ 
    alive: true, 
    time: new Date().toISOString(),
    bot: 'VORTE PRO'
  });
});

// Start Express server
let server;
try {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server running on port ${PORT}`);
    console.log('📦 Node version:', process.version);
    console.log('📁 Current directory:', __dirname);
  });
} catch (error) {
  console.error('❌ Failed to start server:', error.message);
  // Try alternative port
  const altPort = parseInt(PORT) + 1;
  server = app.listen(altPort, '0.0.0.0', () => {
    console.log(`🌐 Web server running on alternative port ${altPort}`);
  });
}

// Auto-ping to prevent Render shutdown
setInterval(() => {
  const http = require('http');
  const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/health',
    method: 'GET',
    timeout: 5000
  };
  
  const req = http.request(options, () => {});
  req.on('error', () => {});
  req.end();
}, 300000); // Every 5 minutes

// ===== 2. CHECK AND INSTALL DEPENDENCIES =====
console.log('🔍 Checking dependencies...');

const requiredPackages = [
  '@whiskeysockets/baileys',
  'qrcode',
  'yt-search',
  'pino'
];

function checkDependencies() {
  const missing = [];
  for (const pkg of requiredPackages) {
    try {
      require.resolve(pkg);
    } catch (e) {
      missing.push(pkg);
    }
  }
  
  if (missing.length > 0) {
    console.error('❌ Missing dependencies:', missing);
    console.log('📦 Installing dependencies...');
    
    // Try to install if we have permission
    const { execSync } = require('child_process');
    try {
      execSync(`npm install ${missing.join(' ')} --no-audit --no-fund`, { stdio: 'inherit' });
      console.log('✅ Dependencies installed');
    } catch (installError) {
      console.error('❌ Failed to install dependencies. Please run:');
      console.error(`npm install ${missing.join(' ')}`);
      process.exit(1);
    }
  } else {
    console.log('✅ All dependencies found');
  }
}

// Wait a moment then check dependencies
setTimeout(checkDependencies, 1000);

// ===== 3. WHATSAPP BOT CODE =====
let botStarted = false;

async function startWhatsAppBot() {
  if (botStarted) {
    console.log('⚠️ Bot already started');
    return;
  }
  
  console.log('🤖 Starting WhatsApp bot...');
  
  try {
    // Import required modules
    const {
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
      fetchLatestBaileysVersion,
      makeCacheableSignalKeyStore,
    } = require("@whiskeysockets/baileys");
    
    const P = require("pino");
    const fs = require("fs");
    const path = require("path");
    const yts = require("yt-search");
    const QRCode = require("qrcode");

    // ===== CONFIGURATION =====
    const BOT_NAME = process.env.BOT_NAME || "VORTE PRO";
    const PREFIX = process.env.PREFIX || ".";
    
    // Owners configuration
    global.owner = [
      [process.env.OWNER_1 || "+255778271055", "Primary Owner", true],
      [process.env.OWNER_2 || "+6285863023532", "Secondary Owner", true],
    ];
    
    global.sudo = ["255778271055", "+6285863023532"];
    
    // Session management
    const SESSION_FOLDER = process.env.SESSION_FOLDER || "./session";
    
    // Create session folder
    try {
      if (!fs.existsSync(SESSION_FOLDER)) {
        fs.mkdirSync(SESSION_FOLDER, { recursive: true });
        console.log(`✅ Created session folder: ${SESSION_FOLDER}`);
      }
    } catch (folderError) {
      console.error('❌ Failed to create session folder:', folderError.message);
      // Try alternative location
      const altFolder = path.join(__dirname, 'tmp_session');
      if (!fs.existsSync(altFolder)) {
        fs.mkdirSync(altFolder, { recursive: true });
      }
      console.log(`✅ Using alternative session folder: ${altFolder}`);
    }

    // ===== DATA STORES =====
    const games = {
      ticTacToe: {},
      hangman: {},
      quizzes: {},
    };
    
    const lastCommand = {};
    const messageCounters = {};

    // ===== HELPER FUNCTIONS =====
    function isGroup(jid) {
      return jid && jid.endsWith("@g.us");
    }
    
    function jidToNumber(jid) {
      return jid ? jid.split("@")[0] : jid;
    }
    
    function formatTime() {
      return new Date().toLocaleTimeString();
    }
    
    function tttBoardToText(board) {
      let out = "";
      for (let r = 0; r < 3; r++) {
        out += ` ${board[r * 3] || (r * 3 + 1)} | ${board[r * 3 + 1] || (r * 3 + 2)} | ${board[r * 3 + 2] || (r * 3 + 3)}\n`;
        if (r < 2) out += "---+---+---\n";
      }
      return out;
    }
    
    // Cleanup old games
    setInterval(() => {
      const now = Date.now();
      const oneHour = 3600000;
      
      // Clean tic-tac-toe games
      Object.keys(games.ticTacToe).forEach(key => {
        if (games.ticTacToe[key].createdAt && (now - games.ticTacToe[key].createdAt) > oneHour) {
          delete games.ticTacToe[key];
        }
      });
      
      // Clean hangman games
      Object.keys(games.hangman).forEach(key => {
        if (games.hangman[key].createdAt && (now - games.hangman[key].createdAt) > oneHour) {
          delete games.hangman[key];
        }
      });
    }, 300000); // Every 5 minutes

    // ===== BOT INITIALIZATION =====
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_FOLDER);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      logger: P({ level: "silent" }),
      printQRInTerminal: true,
      browser: [BOT_NAME, "Chrome", "1.0.0"],
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, P().child({ level: "silent" })),
      },
      version,
    });

    sock.ev.on("creds.update", saveCreds);

    // ===== CONNECTION HANDLING =====
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log("📱 QR Code received - Scan with WhatsApp");
      }
      
      if (connection === "close") {
        const code = lastDisconnect?.error?.output?.statusCode;
        console.log(`🔌 Connection closed. Code: ${code}`);
        
        if (code !== DisconnectReason.loggedOut) {
          console.log("🔄 Reconnecting in 5 seconds...");
          setTimeout(startWhatsAppBot, 5000);
        } else {
          console.log("🚪 Logged out. Delete session folder to rescan QR.");
        }
      }
      
      if (connection === "open") {
        console.log(`✅ ${BOT_NAME} connected successfully at ${formatTime()}`);
        botStarted = true;
        
        // Update server status
        try {
          require('http').get(`http://localhost:${PORT}/health`, () => {});
        } catch (e) {}
      }
    });

    // ===== MESSAGE HANDLER =====
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      
      try {
        const m = messages[0];
        if (!m || m.key?.fromMe) return;

        const chat = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;
        const senderNum = jidToNumber(sender);
        const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        
        // Initialize message counter
        if (!messageCounters[chat]) {
          messageCounters[chat] = { total: 0, today: 0 };
        }
        messageCounters[chat].total++;
        
        // Command cooldown
        const now = Date.now();
        const cooldownKey = `${chat}_${sender}`;
        if (lastCommand[cooldownKey] && (now - lastCommand[cooldownKey]) < 1000) {
          return;
        }
        lastCommand[cooldownKey] = now;

        // Presence updates
        setTimeout(() => sock.sendPresenceUpdate("composing", chat), 200);
        setTimeout(() => sock.sendPresenceUpdate("recording", chat), 1500);

        // Anti-delete feature
        if (m.message?.protocolMessage && m.message.protocolMessage.type === 0) {
          const deleted = m.message.protocolMessage.key;
          const user = deleted.participant || m.key.remoteJid;
          await sock.sendMessage(deleted.remoteJid || chat, {
            text: `⚠️ Anti-Delete: Message deleted by @${jidToNumber(user)}`,
            mentions: [user]
          });
          return;
        }

        // Get message text
        const msgText =
          m.message?.conversation ||
          m.message?.extendedTextMessage?.text ||
          m.message?.imageMessage?.caption ||
          m.message?.videoMessage?.caption ||
          "";
        
        const body = (msgText || "").trim();
        const isCmd = body.startsWith(PREFIX);
        const command = isCmd ? body.slice(PREFIX.length).split(/\s+/)[0].toLowerCase() : "";
        const args = isCmd ? body.slice(PREFIX.length).split(/\s+/).slice(1) : [];
        const arg = args.join(" ");

        if (!isCmd) return;

        console.log(`📨 Command: ${command} from ${senderNum} in ${isGroup(chat) ? 'group' : 'DM'}`);

        // ===== COMMAND HANDLERS =====
        
        // ----- HELP & INFO -----
        if (command === "ping") {
          const start = Date.now();
          await sock.sendMessage(chat, { text: "Pinging..." });
          const latency = Date.now() - start;
          await sock.sendMessage(chat, { text: `🏓 Pong! Latency: ${latency}ms` });
          return;
        }

        if (command === "menu" || command === "help") {
          const menu = `🔥 *${BOT_NAME} MENU* 🔥

👥 *GROUP COMMANDS*
• .tagall - Mention all members
• .promote @user - Promote user to admin
• .demote @user - Demote admin
• .kick @user - Remove user
• .leave - Bot leaves group

📊 *BOT CONTROLS*
• .ping - Check bot latency
• .menu - Show this menu
• .owner - Show bot owner
• .setnamebot <name> - Change bot name
• .setbio <text> - Change bot bio

🎮 *GAMES*
• .tictactoe @user - Start Tic Tac Toe
• .tttmove <1-9> - Make move
• .hangmanstart - Start Hangman
• .hangmanguess <letter> - Guess letter
• .quizstart - Start quiz
• .quizanswer <answer> - Answer quiz

🎵 *MEDIA & UTILS*
• .sticker - Make sticker from image
• .qr <text> - Generate QR code
• .song <name> - Search YouTube song
• .yt <query> - Search YouTube

🎲 *FUN COMMANDS*
• .joke - Random joke
• .quote - Inspirational quote
• .truth - Truth question
• .dare - Dare challenge
• .dice - Roll dice
• .coin - Flip coin
• .guess - Guess number

🔧 *TOOLS*
• .math <equation> - Calculate
• .echo <text> - Echo text
• .say <text> - Bot says text
• .reverse <text> - Reverse text
• .countchars <text> - Count characters

👑 *OWNER ONLY*
• .sudo <code> - Execute code
• .broadcast <msg> - Broadcast message

Type . before each command!`;
          await sock.sendMessage(chat, { text: menu });
          return;
        }

        if (command === "owner") {
          const owners = global.owner.map((o, i) => `${i+1}. ${o[0]} - ${o[1]}`).join("\n");
          await sock.sendMessage(chat, { text: `👑 *Bot Owners*\n\n${owners}` });
          return;
        }

        if (command === "stats") {
          const totalChats = Object.keys(messageCounters).length;
          const totalMsgs = Object.values(messageCounters).reduce((sum, counter) => sum + counter.total, 0);
          const uptime = process.uptime();
          const hours = Math.floor(uptime / 3600);
          const minutes = Math.floor((uptime % 3600) / 60);
          const seconds = Math.floor(uptime % 60);
          
          const stats = `📊 *Bot Statistics*
• Active chats: ${totalChats}
• Total messages: ${totalMsgs}
• Uptime: ${hours}h ${minutes}m ${seconds}s
• Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
• Platform: ${process.platform}`;
          
          await sock.sendMessage(chat, { text: stats });
          return;
        }

        // ----- BOT SETTINGS -----
        if (command === "setnamebot") {
          if (!arg) return sock.sendMessage(chat, { text: `Usage: .setnamebot <name>` });
          
          // Check if sender is owner
          const isOwner = global.owner.some(owner => owner[0].includes(senderNum.replace('+', '')));
          if (!isOwner) {
            return sock.sendMessage(chat, { text: "❌ Owner only command." });
          }
          
          try {
            await sock.updateProfileName(arg);
            await sock.sendMessage(chat, { text: `✅ Bot name changed to: ${arg}` });
          } catch (e) {
            await sock.sendMessage(chat, { text: "❌ Failed to change name." });
          }
          return;
        }

        if (command === "setbio") {
          if (!arg) return sock.sendMessage(chat, { text: `Usage: .setbio <text>` });
          
          const isOwner = global.owner.some(owner => owner[0].includes(senderNum.replace('+', '')));
          if (!isOwner) {
            return sock.sendMessage(chat, { text: "❌ Owner only command." });
          }
          
          try {
            await sock.updateProfileStatus(arg);
            await sock.sendMessage(chat, { text: `✅ Bio updated to: ${arg}` });
          } catch (e) {
            await sock.sendMessage(chat, { text: "❌ Failed to update bio." });
          }
          return;
        }

        // ----- GROUP COMMANDS -----
        if (command === "tagall" || command === "everyone") {
          if (!isGroup(chat)) {
            return sock.sendMessage(chat, { text: "❌ Group only command." });
          }
          
          const isAdmin = global.owner.some(owner => owner[0].includes(senderNum.replace('+', '')));
          if (!isAdmin) {
            return sock.sendMessage(chat, { text: "❌ Admin only command." });
          }
          
          try {
            const metadata = await sock.groupMetadata(chat);
            const members = metadata.participants.map(u => u.id);
            let textTag = "📣 *Tagging Everyone*\n\n";
            members.forEach(u => textTag += `@${u.split("@")[0]}\n`);
            await sock.sendMessage(chat, { 
              text: textTag, 
              mentions: members 
            });
          } catch (e) {
            await sock.sendMessage(chat, { text: "❌ Failed to tag everyone." });
          }
          return;
        }

        if (command === "promote") {
          if (!isGroup(chat)) return sock.sendMessage(chat, { text: "❌ Group only command." });
          if (mentions.length === 0) return sock.sendMessage(chat, { text: `Usage: .promote @user` });
          
          try {
            const metadata = await sock.groupMetadata(chat);
            const botParticipant = metadata.participants.find(p => p.id === sock.user.id);
            if (!botParticipant || !botParticipant.admin) {
              return sock.sendMessage(chat, { text: "❌ Bot needs to be admin." });
            }
            
            await sock.groupParticipantsUpdate(chat, mentions, "promote");
            await sock.sendMessage(chat, { 
              text: `✅ Promoted ${mentions.length} user(s)`, 
              mentions: mentions 
            });
          } catch (e) {
            await sock.sendMessage(chat, { text: "❌ Failed to promote user(s)." });
          }
          return;
        }

        if (command === "demote") {
          if (!isGroup(chat)) return sock.sendMessage(chat, { text: "❌ Group only command." });
          if (mentions.length === 0) return sock.sendMessage(chat, { text: `Usage: .demote @user` });
          
          try {
            const metadata = await sock.groupMetadata(chat);
            const botParticipant = metadata.participants.find(p => p.id === sock.user.id);
            if (!botParticipant || !botParticipant.admin) {
              return sock.sendMessage(chat, { text: "❌ Bot needs to be admin." });
            }
            
            await sock.groupParticipantsUpdate(chat, mentions, "demote");
            await sock.sendMessage(chat, { 
              text: `⚠️ Demoted ${mentions.length} user(s)`, 
              mentions: mentions 
            });
          } catch (e) {
            await sock.sendMessage(chat, { text: "❌ Failed to demote user(s)." });
          }
          return;
        }

        if (command === "kick") {
          if (!isGroup(chat)) return sock.sendMessage(chat, { text: "❌ Group only command." });
          if (mentions.length === 0) return sock.sendMessage(chat, { text: `Usage: .kick @user` });
          
          try {
            const metadata = await sock.groupMetadata(chat);
            const botParticipant = metadata.participants.find(p => p.id === sock.user.id);
            if (!botParticipant || !botParticipant.admin) {
              return sock.sendMessage(chat, { text: "❌ Bot needs to be admin." });
            }
            
            await sock.groupParticipantsUpdate(chat, mentions, "remove");
            await sock.sendMessage(chat, { 
              text: `👢 Removed ${mentions.length} user(s)`, 
              mentions: mentions 
            });
          } catch (e) {
            await sock.sendMessage(chat, { text: "❌ Failed to remove user(s)." });
          }
          return;
        }

        if (command === "leave") {
          if (!isGroup(chat)) {
            return sock.sendMessage(chat, { text: "❌ This command only works in groups." });
          }
          
          const isOwner = global.owner.some(owner => owner[0].includes(senderNum.replace('+', '')));
          if (!isOwner) {
            return sock.sendMessage(chat, { text: "❌ Owner only command." });
          }
          
          try {
            await sock.sendMessage(chat, { text: "👋 Leaving group..." });
            await sock.groupLeave(chat);
          } catch (e) {
            await sock.sendMessage(chat, { text: "❌ Failed to leave group." });
          }
          return;
        }

        // ----- STICKER -----
        if (command === "sticker" || command === "s") {
          try {
            let mediaMsg = m;
            if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
              mediaMsg = { 
                key: m.key, 
                message: m.message.extendedTextMessage.contextInfo.quotedMessage 
              };
            }
            
            const media = mediaMsg.message?.imageMessage || mediaMsg.message?.videoMessage;
            if (!media) {
              await sock.sendMessage(chat, { 
                text: "📸 Reply to an image/video or send one with caption .sticker" 
              });
              return;
            }
            
            const stream = await sock.downloadMediaMessage(mediaMsg);
            await sock.sendMessage(chat, { sticker: stream });
          } catch (e) {
            console.error('Sticker error:', e);
            await sock.sendMessage(chat, { text: "❌ Could not create sticker." });
          }
          return;
        }

        // ----- MUSIC & YOUTUBE -----
        if (command === "song" || command === "yt") {
          if (!arg) return await sock.sendMessage(chat, { text: `Usage: .song <song name>` });
          
          try {
            const search = await yts(arg);
            const videos = search.videos.slice(0, 3);
            
            if (!videos.length) {
              return await sock.sendMessage(chat, { text: "❌ No results found." });
            }
            
            let resultText = "🎵 *Search Results:*\n\n";
            videos.forEach((video, i) => {
              resultText += `${i+1}. *${video.title}*\n`;
              resultText += `   ⏱️ ${video.timestamp}\n`;
              resultText += `   👁️ ${video.views} views\n`;
              resultText += `   🔗 ${video.url}\n\n`;
            });
            
            await sock.sendMessage(chat, { text: resultText });
          } catch (e) {
            console.error('YouTube search error:', e);
            await sock.sendMessage(chat, { text: "❌ Error searching for song." });
          }
          return;
        }

        // ----- MATH -----
        if (command === "math") {
          if (!arg) return sock.sendMessage(chat, { text: `Example: .math 5+5*2` });
          
          try {
            // Safe math evaluation
            const safeArg = arg.replace(/[^0-9+\-*/().\s]/g, '');
            let answer = eval(safeArg);
            await sock.sendMessage(chat, { text: `🧮 ${arg} = *${answer}*` });
          } catch (e) {
            await sock.sendMessage(chat, { text: "❌ Invalid equation." });
          }
          return;
        }

        // ----- QR CODE -----
        if (command === "qr") {
          if (!arg) return sock.sendMessage(chat, { text: `Example: .qr hello world` });
          
          try {
            const qrText = arg.length > 500 ? arg.substring(0, 500) : arg;
            const qrImg = await QRCode.toBuffer(qrText, {
              errorCorrectionLevel: 'M',
              margin: 2,
              width: 300
            });
            await sock.sendMessage(chat, { 
              image: qrImg, 
              caption: `QR Code for: ${qrText.substring(0, 50)}${qrText.length > 50 ? '...' : ''}` 
            });
          } catch (e) {
            console.error('QR error:', e);
            await sock.sendMessage(chat, { text: "❌ Failed to generate QR code." });
          }
          return;
        }

        // ----- OWNER COMMANDS -----
        if (command === "sudo") {
          const primaryOwner = global.owner[0][0].replace('+', '');
          if (senderNum !== primaryOwner) {
            return await sock.sendMessage(chat, { text: "❌ Owner only command." });
          }
          
          const code = arg;
          if (!code) return await sock.sendMessage(chat, { text: `Usage: .sudo <javascript code>` });
          
          try {
            let result = eval(code);
            const resultStr = String(result).slice(0, 2000);
            await sock.sendMessage(chat, { text: `✅ Result:\n\`\`\`${resultStr}\`\`\`` });
          } catch (e) {
            await sock.sendMessage(chat, { text: `❌ Error:\n\`\`\`${String(e)}\`\`\`` });
          }
          return;
        }

        if (command === "broadcast") {
          const primaryOwner = global.owner[0][0].replace('+', '');
          if (senderNum !== primaryOwner) {
            return await sock.sendMessage(chat, { text: "❌ Owner only command." });
          }
          
          const messageToSend = arg;
          if (!messageToSend) {
            return await sock.sendMessage(chat, { text: `Usage: .broadcast <message>` });
          }
          
          await sock.sendMessage(chat, { text: `📢 Starting broadcast to all chats...` });
          
          let success = 0;
          let failed = 0;
          const chats = Object.keys(sock.store.chats || {}).slice(0, 50); // Limit to 50 chats
          
          for (const c of chats) {
            if (c.endsWith('@g.us') || c.endsWith('@s.whatsapp.net')) {
              try {
                await sock.sendMessage(c, { 
                  text: `📢 *Broadcast from ${BOT_NAME}*\n\n${messageToSend}` 
                });
                success++;
                await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
              } catch (e) {
                failed++;
              }
            }
          }
          
          await sock.sendMessage(chat, { 
            text: `✅ Broadcast completed!\n• Sent: ${success}\n• Failed: ${failed}` 
          });
          return;
        }

        // ----- FUN COMMANDS -----
        if (command === "quote") {
          const quotes = [
            "The only way to do great work is to love what you do. - Steve Jobs",
            "Innovation distinguishes between a leader and a follower. - Steve Jobs",
            "Your time is limited, don't waste it living someone else's life. - Steve Jobs",
            "Stay hungry, stay foolish. - Steve Jobs"
          ];
          const quote = quotes[Math.floor(Math.random() * quotes.length)];
          await sock.sendMessage(chat, { text: `💬 "${quote}"` });
          return;
        }
        
        if (command === "joke") {
          const jokes = [
            "Why don't scientists trust atoms? Because they make up everything!",
            "Why did the scarecrow win an award? He was outstanding in his field!",
            "What do you call a bear with no teeth? A gummy bear!",
            "Why don't eggs tell jokes? They'd crack each other up!"
          ];
          const joke = jokes[Math.floor(Math.random() * jokes.length)];
          await sock.sendMessage(chat, { text: `😂 ${joke}` });
          return;
        }
        
        if (command === "guess") {
          const number = Math.floor(Math.random() * 10) + 1;
          await sock.sendMessage(chat, { text: `🎲 I'm thinking of a number between 1-10...\nIt's *${number}*!` });
          return;
        }
        
        if (command === "truth") {
          const truths = [
            "What's your biggest fear?",
            "What's the most embarrassing thing you've ever done?",
            "Have you ever lied to get out of trouble?",
            "What's one thing you would change about yourself?"
          ];
          const truth = truths[Math.floor(Math.random() * truths.length)];
          await sock.sendMessage(chat, { text: `🤔 Truth: ${truth}` });
          return;
        }
        
        if (command === "dare") {
          const dares = [
            "Send a voice note singing your favorite song!",
            "Change your profile picture to something funny for 1 hour!",
            "Send the last photo in your gallery!",
            "Call a random contact and say hello!"
          ];
          const dare = dares[Math.floor(Math.random() * dares.length)];
          await sock.sendMessage(chat, { text: `😈 Dare: ${dare}` });
          return;
        }
        
        if (command === "dice") {
          const dice = Math.floor(Math.random() * 6) + 1;
          await sock.sendMessage(chat, { text: `🎲 You rolled: ${dice}` });
          return;
        }
        
        if (command === "coin") {
          const result = Math.random() < 0.5 ? "Heads" : "Tails";
          await sock.sendMessage(chat, { text: `🪙 ${result}!` });
          return;
        }

        if (command === "say") {
          if (!arg) return sock.sendMessage(chat, { text: `Usage: .say <text>` });
          await sock.sendMessage(chat, { text: arg });
          return;
        }

        // ----- GAMES -----
        if (command === "tictactoe" || command === "ttt") {
          const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
          if (mentioned.length === 0) {
            await sock.sendMessage(chat, { text: `Usage: .ttt @user — mention the user you challenge` });
            return;
          }
          
          const opponent = mentioned[0];
          const initiator = m.key.participant || m.key.remoteJid;
          
          if (opponent === initiator) {
            return await sock.sendMessage(chat, { text: "You cannot challenge yourself." });
          }
          
          games.ticTacToe[chat] = {
            board: Array(9).fill(""),
            players: [initiator, opponent],
            turn: initiator,
            status: "playing",
            createdAt: Date.now()
          };
          
          await sock.sendMessage(chat, { 
            text: `🎮 *Tic Tac Toe Started!*\n\nPlayer X: @${jidToNumber(initiator)}\nPlayer O: @${jidToNumber(opponent)}\n\nCurrent board:\n${tttBoardToText(games.ticTacToe[chat].board)}\n\nIt's X's turn! Use .tttmove <1-9>` 
          });
          return;
        }

        if (command === "tttmove") {
          const game = games.ticTacToe[chat];
          if (!game) {
            return await sock.sendMessage(chat, { text: `No active game. Start with ${PREFIX}ttt @user` });
          }
          
          const move = parseInt(args[0]);
          if (!move || move < 1 || move > 9) {
            return await sock.sendMessage(chat, { text: `Usage: .tttmove <1-9>` });
          }
          
          const player = m.key.participant || m.key.remoteJid;
          if (player !== game.turn) {
            return await sock.sendMessage(chat, { text: "It's not your turn!" });
          }
          
          if (game.board[move - 1]) {
            return await sock.sendMessage(chat, { text: "Cell already taken!" });
          }
          
          const symbol = game.players[0] === player ? "X" : "O";
          game.board[move - 1] = symbol;
          
          // Check for win
          const wins = [
            [0,1,2],[3,4,5],[6,7,8], // rows
            [0,3,6],[1,4,7],[2,5,8], // columns
            [0,4,8],[2,4,6]          // diagonals
          ];
          
          let winner = null;
          for (const [a,b,c] of wins) {
            if (game.board[a] && game.board[a] === game.board[b] && game.board[a] === game.board[c]) {
              winner = game.board[a];
              break;
            }
          }
          
          let boardText = tttBoardToText(game.board);
          
          if (winner) {
            const winnerJid = game.players[winner === "X" ? 0 : 1];
            const winnerNum = jidToNumber(winnerJid);
            await sock.sendMessage(chat, { 
              text: `🎉 *Game Over!*\n\n${boardText}\n\nWinner: @${winnerNum} (${winner})`, 
              mentions: [winnerJid] 
            });
            delete games.ticTacToe[chat];
            return;
          }
          
          // Check for draw
          if (game.board.every(cell => cell)) {
            await sock.sendMessage(chat, { text: `🤝 *Draw!*\n\n${boardText}` });
            delete games.ticTacToe[chat];
            return;
          }
          
          // Switch turn
          game.turn = game.players.find(p => p !== player);
          const nextPlayerNum = jidToNumber(game.turn);
          const nextSymbol = game.players[0] === game.turn ? "X" : "O";
          
          await sock.sendMessage(chat, { 
            text: `Next move:\n\n${boardText}\n\nTurn: @${nextPlayerNum} (${nextSymbol})`, 
            mentions: [game.turn] 
          });
          return;
        }

        // ----- HANGMAN -----
        if (command === "hangmanstart") {
          const words = ["javascript", "whatsapp", "computer", "internet", "android", "iphone", "python", "programming"];
          const word = words[Math.floor(Math.random() * words.length)];
          
          games.hangman[chat] = {
            word: word.toLowerCase(),
            display: "_".repeat(word.length).split(""),
            tries: 6,
            guessed: [],
            createdAt: Date.now()
          };
          
          await sock.sendMessage(chat, { 
            text: `🎯 *Hangman Started!*\n\nWord: ${games.hangman[chat].display.join(" ")}\nTries left: 6\n\nGuess a letter with: .hangmanguess <letter>` 
          });
          return;
        }

        if (command === "hangmanguess") {
          const game = games.hangman[chat];
          if (!game) {
            return await sock.sendMessage(chat, { text: `No active game. Start with ${PREFIX}hangmanstart` });
          }
          
          const letter = args[0]?.toLowerCase();
          if (!letter || letter.length !== 1 || !/[a-z]/.test(letter)) {
            return await sock.sendMessage(chat, { text: `Usage: .hangmanguess <single letter>` });
          }
          
          if (game.guessed.includes(letter)) {
            return await sock.sendMessage(chat, { text: "Letter already guessed!" });
          }
          
          game.guessed.push(letter);
          let found = false;
          
          for (let i = 0; i < game.word.length; i++) {
            if (game.word[i] === letter) {
              game.display[i] = letter;
              found = true;
            }
          }
          
          if (!found) {
            game.tries -= 1;
          }
          
          // Check win
          if (game.display.join("") === game.word) {
            await sock.sendMessage(chat, { 
              text: `🎉 *You Won!*\n\nThe word was: *${game.word}*\nTries left: ${game.tries}` 
            });
            delete games.hangman[chat];
            return;
          }
          
          // Check lose
          if (game.tries <= 0) {
            await sock.sendMessage(chat, { 
              text: `💀 *Game Over!*\n\nThe word was: *${game.word}*\n\nBetter luck next time!` 
            });
            delete games.hangman[chat];
            return;
          }
          
          // Show progress
          const hangmanStates = [
            "  ____\n  |  |\n     |\n     |\n     |\n     |\n_____|___",
            "  ____\n  |  |\n  O  |\n     |\n     |\n     |\n_____|___",
            "  ____\n  |  |\n  O  |\n  |  |\n     |\n     |\n_____|___",
            "  ____\n  |  |\n  O  |\n /|  |\n     |\n     |\n_____|___",
            "  ____\n  |  |\n  O  |\n /|\\ |\n     |\n     |\n_____|___",
            "  ____\n  |  |\n  O  |\n /|\\ |\n /   |\n     |\n_____|___",
            "  ____\n  |  |\n  O  |\n /|\\ |\n / \\ |\n     |\n_____|___"
          ];
          
          const stateIndex = 6 - game.tries;
          const hangmanArt = hangmanStates[stateIndex];
          
          await sock.sendMessage(chat, { 
            text: `${hangmanArt}\n\nWord: ${game.display.join(" ")}\nTries left: ${game.tries}\nGuessed: ${game.guessed.join(", ")}` 
          });
          return;
        }

        // ----- QUIZ -----
        if (command === "quizstart") {
          const quizzes = [
            {
              q: "What is the capital of France?",
              choices: ["London", "Berlin", "Paris", "Madrid"],
              answer: "Paris"
            },
            {
              q: "How many continents are there?",
              choices: ["5", "6", "7", "8"],
              answer: "7"
            },
            {
              q: "What is 2+2?",
              choices: ["3", "4", "5", "6"],
              answer: "4"
            }
          ];
          
          const quiz = quizzes[Math.floor(Math.random() * quizzes.length)];
          games.quizzes[chat] = {
            ...quiz,
            active: true,
            createdAt: Date.now()
          };
          
          await sock.sendMessage(chat, { 
            text: `🧠 *Quiz Started!*\n\nQuestion: ${quiz.q}\n\nChoices: ${quiz.choices.join(", ")}\n\nAnswer with: .quizanswer <answer>` 
          });
          return;
        }

        if (command === "quizanswer") {
          const quiz = games.quizzes[chat];
          if (!quiz || !quiz.active) {
            return await sock.sendMessage(chat, { text: `No active quiz. Start with ${PREFIX}quizstart` });
          }
          
          if (!arg) {
            return await sock.sendMessage(chat, { text: `Usage: .quizanswer <answer>` });
          }
          
          const userAnswer = arg.trim().toLowerCase();
          const correctAnswer = quiz.answer.toLowerCase();
          
          if (userAnswer === correctAnswer) {
            await sock.sendMessage(chat, { text: `✅ *Correct!* The answer is ${quiz.answer}` });
          } else {
            await sock.sendMessage(chat, { text: `❌ *Wrong!* The correct answer is ${quiz.answer}` });
          }
          
          delete games.quizzes[chat];
          return;
        }

        // ----- UTILITY COMMANDS -----
        if (command === "echo") {
          await sock.sendMessage(chat, { text: arg || `Usage: .echo <text>` });
          return;
        }

        if (command === "reverse") {
          if (!arg) return sock.sendMessage(chat, { text: `Usage: .reverse <text>` });
          const reversed = arg.split("").reverse().join("");
          await sock.sendMessage(chat, { text: reversed });
          return;
        }

        if (command === "countchars") {
          if (!arg) return sock.sendMessage(chat, { text: `Usage: .countchars <text>` });
          const count = arg.length;
          const wordCount = arg.trim().split(/\s+/).length;
          await sock.sendMessage(chat, { text: `📊 Text Analysis:\n• Characters: ${count}\n• Words: ${wordCount}` });
          return;
        }

        // ----- FALLBACK -----
        await sock.sendMessage(chat, { 
          text: `❓ Unknown command: *${command}*\n\nType .menu* for list of commands.` 
        });

      } catch (error) {
        console.error('Message processing error:', error);
        try {
          await sock.sendMessage(chat, { 
            text: '⚠️ An error occurred while processing your command.' 
          });
        } catch (sendError) {
          console.error('Failed to send error message:', sendError);
        }
      }
    });

    // ===== CONTACT WELCOME =====
    sock.ev.on("contacts.upsert", async (contacts) => {
      try {
        for (const contact of contacts) {
          const num = contact.id;
          if (!num || num.endsWith('@g.us')) continue;
          
          // Send welcome message
          await sock.sendMessage(num, { 
            text: `👋 Hello! I'm *${BOT_NAME}*\n\nType *.menu* to see all commands.\n\nNeed help? Contact my owner!` 
          });
        }
      } catch (error) {
        console.error('Welcome message error:', error);
      }
    });

    // ===== GROUP UPDATES =====
    sock.ev.on("groups.update", async (updates) => {
      for (const update of updates) {
        console.log(`Group update for ${update.id}:`, update);
      }
    });

    console.log(`✅ ${VORTE PRO} is ready!`);
    return sock;

  } catch (error) {
    console.error('❌ Failed to start WhatsApp bot:', error);
    
    // Try again in 10 seconds
    setTimeout(() => {
      console.log('🔄 Retrying bot startup...');
      startWhatsAppBot();
    }, 10000);
    
    return null;
  }
}

// ===== 4. START BOT AFTER SERVER IS READY =====
server.on('listening', () => {
  console.log('✅ Server is ready, starting WhatsApp bot in 3 seconds...');
  setTimeout(() => {
    startWhatsAppBot().then(sock => {
      if (sock) {
        console.log('🎉 Bot successfully started!');
        console.log('👉 Access your bot at:');
        console.log(`   http://localhost:${PORT}`);
        console.log(`   http://localhost:${PORT}/health`);
      }
    });
  }, 3000);
});

// ===== 5. ERROR HANDLING =====
process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception:', error.message);
  console.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Startup message
console.log(`
=========================================
🤖 VORTE PRO WhatsApp Bot
🌐 Server starting on port ${PORT}
📦 Version: 1.0.0
=========================================
`);