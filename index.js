/**
 * WhatsApp MD Bot - Main Entry Point
 * Supports tmt~ session ID format
 * 24/7 on Render & Heroku
 */
process.env.PUPPETEER_SKIP_DOWNLOAD = 'true';
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'true';
process.env.PUPPETEER_CACHE_DIR = process.env.PUPPETEER_CACHE_DIR || '/tmp/puppeteer_cache_disabled';

const { initializeTempSystem } = require('./utils/tempManager');
const { startCleanup } = require('./utils/cleanup');
initializeTempSystem();
startCleanup();

// ========== ADDED: Keep Alive for Render/Heroku ==========
const express = require('express');
const keepAliveApp = express();
const keepAlivePort = process.env.PORT || 3000;

keepAliveApp.get('/health', (req, res) => {
  res.json({
    status: 'alive',
    uptime: process.uptime(),
    sessionType: config.sessionID ? (config.sessionID.startsWith('tmt~') ? 'tmt session' : 'unknown') : 'none',
    timestamp: Date.now()
  });
});

keepAliveApp.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>WhatsApp Bot - 24/7</title></head>
    <body>
      <h1>🤖 WhatsApp Bot is Running 24/7!</h1>
      <p>Status: <span style="color:green">🟢 Online</span></p>
      <p>Session Format: <strong>tmt~</strong></p>
      <p>Uptime: ${Math.floor(process.uptime())} seconds</p>
      <hr>
      <p>✅ Bot is active and receiving messages</p>
    </body>
    </html>
  `);
});

const server = keepAliveApp.listen(keepAlivePort, () => {
  console.log(`✅ Keep-alive server running on port ${keepAlivePort}`);
  console.log(`✅ Health check: http://localhost:${keepAlivePort}/health`);
});

// Self-ping every 60 seconds to keep Render/Heroku awake
setInterval(async () => {
  try {
    const url = process.env.RENDER_URL || process.env.HEROKU_URL || `http://localhost:${keepAlivePort}`;
    await fetch(`${url}/health`);
    console.log('🔄 Self-ping sent');
  } catch (e) {
    // Silent fail for local development
  }
}, 60000);
// ========== END KEEP ALIVE ==========

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

const forbiddenPatternsConsole = [
  'closing session',
  'closing open session',
  'sessionentry',
  'prekey bundle',
  'pendingprekey',
  '_chains',
  'registrationid',
  'currentratchet',
  'chainkey',
  'ratchet',
  'signal protocol',
  'ephemeralkeypair',
  'indexinfo',
  'basekey'
];

console.log = (...args) => {
  const message = args.map(a => typeof a === 'string' ? a : typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').toLowerCase();
  if (!forbiddenPatternsConsole.some(pattern => message.includes(pattern))) {
    originalConsoleLog.apply(console, args);
  }
};

console.error = (...args) => {
  const message = args.map(a => typeof a === 'string' ? a : typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').toLowerCase();
  if (!forbiddenPatternsConsole.some(pattern => message.includes(pattern))) {
    originalConsoleError.apply(console, args);
  }
};

console.warn = (...args) => {
  const message = args.map(a => typeof a === 'string' ? a : typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').toLowerCase();
  if (!forbiddenPatternsConsole.some(pattern => message.includes(pattern))) {
    originalConsoleWarn.apply(console, args);
  }
};

// Now safe to load libraries
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const config = require('./config');
const handler = require('./handler');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const os = require('os');
const crypto = require('crypto');

// ========== ADDED: tmt~ Session ID Support ==========
// Generate short tmt session ID (8 characters)
function generateShortTmtSessionId() {
  return 'tmt~' + crypto.randomBytes(4).toString('hex');
}

// Generate long tmt session ID from creds
function generateLongTmtSessionId(creds) {
  const credsJson = JSON.stringify(creds);
  const base64 = Buffer.from(credsJson).toString('base64');
  return 'tmt~' + base64;
}

// Compress and encode session for tmt~ format
function compressSession(creds) {
  const credsJson = JSON.stringify(creds);
  const compressed = zlib.gzipSync(credsJson);
  const base64 = compressed.toString('base64');
  return `tmt~${base64}`;
}

// Decompress tmt~ session
function decompressSession(sessionId) {
  if (!sessionId || !sessionId.startsWith('tmt~')) return null;
  
  try {
    const base64Data = sessionId.substring(4); // Remove 'tmt~'
    const compressed = Buffer.from(base64Data, 'base64');
    const decompressed = zlib.gunzipSync(compressed);
    return JSON.parse(decompressed.toString('utf-8'));
  } catch (e) {
    console.error('Failed to decompress tmt~ session:', e.message);
    return null;
  }
}

// Save session mapping for tmt~ short IDs
const sessionMappingPath = path.join(__dirname, 'tmt_sessions.json');

function saveTmtSessionMapping(shortId, longId, sessionPath) {
  let mapping = {};
  if (fs.existsSync(sessionMappingPath)) {
    mapping = JSON.parse(fs.readFileSync(sessionMappingPath, 'utf8'));
  }
  
  mapping[shortId.replace('tmt~', '')] = {
    shortId: shortId,
    longId: longId,
    sessionPath: sessionPath,
    createdAt: Date.now()
  };
  
  fs.writeFileSync(sessionMappingPath, JSON.stringify(mapping, null, 2));
}

function getTmtSessionMapping(shortId) {
  if (!fs.existsSync(sessionMappingPath)) return null;
  
  const mapping = JSON.parse(fs.readFileSync(sessionMappingPath, 'utf8'));
  const cleanId = shortId.replace('tmt~', '');
  return mapping[cleanId] || null;
}
// ========== END tmt~ Session Support ==========

// Remove Puppeteer cache
function cleanupPuppeteerCache() {
  try {
    const home = os.homedir();
    const cacheDir = path.join(home, '.cache', 'puppeteer');

    if (fs.existsSync(cacheDir)) {
      console.log('🧹 Removing Puppeteer cache at:', cacheDir);
      fs.rmSync(cacheDir, { recursive: true, force: true });
      console.log('✅ Puppeteer cache removed');
    }
  } catch (err) {
    console.error('⚠️ Failed to cleanup Puppeteer cache:', err.message || err);
  }
}

// Optimized in-memory store
const store = {
  messages: new Map(),
  maxPerChat: 20,

  bind: (ev) => {
    ev.on('messages.upsert', ({ messages }) => {
      for (const msg of messages) {
        if (!msg.key?.id) continue;

        const jid = msg.key.remoteJid;
        if (!store.messages.has(jid)) {
          store.messages.set(jid, new Map());
        }

        const chatMsgs = store.messages.get(jid);
        chatMsgs.set(msg.key.id, msg);

        if (chatMsgs.size > store.maxPerChat) {
          const oldestKey = chatMsgs.keys().next().value;
          chatMsgs.delete(oldestKey);
        }
      }
    });
  },

  loadMessage: async (jid, id) => {
    return store.messages.get(jid)?.get(id) || null;
  }
};

const processedMessages = new Set();

setInterval(() => {
  processedMessages.clear();
}, 5 * 60 * 1000);

const createSuppressedLogger = (level = 'silent') => {
  const forbiddenPatterns = [
    'closing session',
    'closing open session',
    'sessionentry',
    'prekey bundle',
    'pendingprekey',
    '_chains',
    'registrationid',
    'currentratchet',
    'chainkey',
    'ratchet',
    'signal protocol',
    'ephemeralkeypair',
    'indexinfo',
    'basekey',
    'sessionentry',
    'ratchetkey'
  ];

  let logger;
  try {
    logger = pino({
      level,
      transport: process.env.NODE_ENV === 'production' ? undefined : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname'
        }
      },
      customLevels: {
        trace: 0,
        debug: 1,
        info: 2,
        warn: 3,
        error: 4,
        fatal: 5
      },
      redact: ['registrationId', 'ephemeralKeyPair', 'rootKey', 'chainKey', 'baseKey']
    });
  } catch (err) {
    logger = pino({ level });
  }

  const originalInfo = logger.info.bind(logger);
  logger.info = (...args) => {
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ').toLowerCase();
    if (!forbiddenPatterns.some(pattern => msg.includes(pattern))) {
      originalInfo(...args);
    }
  };
  logger.debug = () => { };
  logger.trace = () => { };
  return logger;
};

// Main connection function
async function startBot() {
  const sessionFolder = `./${config.sessionName}`;
  const sessionFile = path.join(sessionFolder, 'creds.json');

  // ========== FIXED: Support tmt~ session ID format ==========
  if (config.sessionID) {
    console.log(`📡 Session ID detected: ${config.sessionID.substring(0, 20)}...`);
    
    // Handle tmt~ format (short or long)
    if (config.sessionID.startsWith('tmt~')) {
      console.log('✅ tmt~ session format detected');
      
      try {
        let creds = null;
        
        // Check if it's a short tmt~ ID (points to stored session)
        if (config.sessionID.length < 50) {
          console.log('📡 Short tmt~ session ID detected, looking up mapping...');
          const mapping = getTmtSessionMapping(config.sessionID);
          
          if (mapping && fs.existsSync(path.join(mapping.sessionPath, 'creds.json'))) {
            creds = JSON.parse(fs.readFileSync(path.join(mapping.sessionPath, 'creds.json'), 'utf8'));
            console.log('✅ Short tmt~ session loaded from storage');
          } else {
            console.log('⚠️ Short tmt~ session not found, will create new session');
          }
        } else {
          // Long tmt~ session (contains compressed creds)
          console.log('📡 Long tmt~ session ID detected, decompressing...');
          creds = decompressSession(config.sessionID);
          if (creds) {
            console.log('✅ Long tmt~ session decompressed successfully');
          }
        }
        
        if (creds) {
          if (!fs.existsSync(sessionFolder)) {
            fs.mkdirSync(sessionFolder, { recursive: true });
          }
          fs.writeFileSync(sessionFile, JSON.stringify(creds, null, 2), 'utf8');
          console.log('✅ tmt~ session credentials saved');
        }
      } catch (e) {
        console.error('❌ Error processing tmt~ session:', e.message);
      }
    }
    // Handle legacy KnightBot! format
    else if (config.sessionID.startsWith('KnightBot!')) {
      try {
        const [header, b64data] = config.sessionID.split('!');

        if (header !== 'KnightBot' || !b64data) {
          throw new Error("❌ Invalid session format. Expected 'KnightBot!.....'");
        }

        const cleanB64 = b64data.replace('...', '');
        const compressedData = Buffer.from(cleanB64, 'base64');
        const decompressedData = zlib.gunzipSync(compressedData);

        if (!fs.existsSync(sessionFolder)) {
          fs.mkdirSync(sessionFolder, { recursive: true });
        }

        fs.writeFileSync(sessionFile, decompressedData, 'utf8');
        console.log('📡 Session: 🔑 Retrieved from KnightBot Session');

      } catch (e) {
        console.error('📡 Session: ❌ Error processing KnightBot session:', e.message);
      }
    }
    // Handle tmt~default special case
    else if (config.sessionID === 'tmt~default') {
      console.log('📡 Using tmt~default session mode');
      // Check if default session exists
      if (fs.existsSync(sessionFile)) {
        console.log('✅ Default session found and loaded');
      } else {
        console.log('⚠️ No default session found, will create new one');
      }
    }
  }
  // ========== END tmt~ Session Support ==========

  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
  const { version } = await fetchLatestBaileysVersion();

  const suppressedLogger = createSuppressedLogger('silent');

  const sock = makeWASocket({
    version,
    logger: suppressedLogger,
    printQRInTerminal: false,
    browser: ['Chrome', 'Windows', '10.0'],
    auth: state,
    syncFullHistory: false,
    downloadHistory: false,
    markOnlineOnConnect: false,
    getMessage: async () => undefined
  });

  store.bind(sock.ev);

  let lastActivity = Date.now();
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

  sock.ev.on('messages.upsert', () => {
    lastActivity = Date.now();
  });

  const watchdogInterval = setInterval(async () => {
    if (Date.now() - lastActivity > INACTIVITY_TIMEOUT && sock.ws && sock.ws.readyState === 1) {
      console.log('⚠️ No activity detected. Forcing reconnect...');
      await sock.end(undefined, undefined, { reason: 'inactive' });
      clearInterval(watchdogInterval);
      setTimeout(() => startBot(), 5000);
    }
  }, 5 * 60 * 1000);

  sock.ev.on('connection.update', (update) => {
    const { connection } = update;
    if (connection === 'open') {
      lastActivity = Date.now();
    } else if (connection === 'close') {
      clearInterval(watchdogInterval);
    }
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n\n📱 Scan this QR code with WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const errorMessage = lastDisconnect?.error?.message || 'Unknown error';

      if (statusCode === 515 || statusCode === 503 || statusCode === 408) {
        console.log(`⚠️ Connection closed (${statusCode}). Reconnecting...`);
      } else {
        console.log('Connection closed due to:', errorMessage, '\nReconnecting:', shouldReconnect);
      }

      if (shouldReconnect) {
        setTimeout(() => startBot(), 3000);
      }
    } else if (connection === 'open') {
      console.log('\n✅ Bot connected successfully!');
      console.log(`📱 Bot Number: ${sock.user.id.split(':')[0]}`);
      console.log(`🤖 Bot Name: ${config.botName}`);
      console.log(`⚡ Prefix: ${config.prefix}`);
      const ownerNames = Array.isArray(config.ownerName) ? config.ownerName.join(',') : config.ownerName;
      console.log(`👑 Owner: ${ownerNames}\n`);
      console.log('Bot is ready to receive messages!\n');

      // ========== ADDED: Save tmt~ session formats ==========
      try {
        const creds = sock.authState.creds;
        const shortTmtId = generateShortTmtSessionId();
        const longTmtId = generateLongTmtSessionId(creds);
        const compressedTmtId = compressSession(creds);
        
        saveTmtSessionMapping(shortTmtId, longTmtId, sessionFolder);
        
        // Save to session folder
        fs.writeFileSync(path.join(sessionFolder, 'tmt_short.id'), shortTmtId);
        fs.writeFileSync(path.join(sessionFolder, 'tmt_long.id'), longTmtId);
        
        console.log(`📡 tmt~ Session Formats Saved:`);
        console.log(`   🔹 Short ID: ${shortTmtId}`);
        console.log(`   🔸 Long ID: ${longTmtId.substring(0, 60)}...`);
        console.log(`   📦 Compressed: ${compressedTmtId.substring(0, 60)}...`);
        
        // Send to owner if configured
        if (config.owner && config.owner[0]) {
          const ownerJid = config.owner[0] + '@s.whatsapp.net';
          await sock.sendMessage(ownerJid, {
            text: `✅ *Bot Connected Successfully!*\n\n` +
                  `📱 *Your tmt~ Session IDs:*\n\n` +
                  `🔹 *SHORT ID* (Save this):\n\`${shortTmtId}\`\n\n` +
                  `🔸 *LONG ID* (Backup):\n\`${longTmtId.substring(0, 100)}...\`\n\n` +
                  `⚠️ Save the SHORT ID - it's only 12 characters!\n` +
                  `📌 Use it as SESSION_ID in your environment variables.\n\n` +
                  `🤖 Bot is running 24/7!`
          });
        }
      } catch (err) {
        console.log(`⚠️ Failed to save tmt~ session: ${err.message}`);
      }
      // ========== END tmt~ session save ==========

      if (config.autoBio) {
        await sock.updateProfileStatus(`${config.botName} | Active 24/7`);
      }

      handler.initializeAntiCall(sock);

      const now = Date.now();
      for (const [jid, chatMsgs] of store.messages.entries()) {
        const timestamps = Array.from(chatMsgs.values()).map(m => m.messageTimestamp * 1000 || 0);
        if (timestamps.length > 0 && now - Math.max(...timestamps) > 24 * 60 * 60 * 1000) {
          store.messages.delete(jid);
        }
      }
      console.log(`🧹 Store cleaned. Active chats: ${store.messages.size}`);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  const isSystemJid = (jid) => {
    if (!jid) return true;
    return jid.includes('@broadcast') ||
      jid.includes('status.broadcast') ||
      jid.includes('@newsletter') ||
      jid.includes('@newsletter.');
  };

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || !msg.key?.id) continue;

      const from = msg.key.remoteJid;
      if (!from) continue;

      if (isSystemJid(from)) continue;

      const msgId = msg.key.id;
      if (processedMessages.has(msgId)) continue;

      const MESSAGE_AGE_LIMIT = 5 * 60 * 1000;
      let messageAge = 0;
      if (msg.messageTimestamp) {
        messageAge = Date.now() - (msg.messageTimestamp * 1000);
        if (messageAge > MESSAGE_AGE_LIMIT) continue;
      }

      processedMessages.add(msgId);

      if (msg.key && msg.key.id) {
        if (!store.messages.has(from)) {
          store.messages.set(from, new Map());
        }
        const chatMsgs = store.messages.get(from);
        chatMsgs.set(msg.key.id, msg);

        if (chatMsgs.size > store.maxPerChat) {
          const sortedIds = Array.from(chatMsgs.entries())
            .sort((a, b) => (a[1].messageTimestamp || 0) - (b[1].messageTimestamp || 0))
            .map(([id]) => id);
          for (let i = 0; i < sortedIds.length - store.maxPerChat; i++) {
            chatMsgs.delete(sortedIds[i]);
          }
        }
      }

      handler.handleMessage(sock, msg).catch(err => {
        if (!err.message?.includes('rate-overlimit') &&
          !err.message?.includes('not-authorized')) {
          console.error('Error handling message:', err.message);
        }
      });

      setImmediate(async () => {
        if (config.autoRead && from.endsWith('@g.us')) {
          try {
            await sock.readMessages([msg.key]);
          } catch (e) {}
        }
        if (from.endsWith('@g.us')) {
          try {
            const groupMetadata = await handler.getGroupMetadata(sock, msg.key.remoteJid);
            if (groupMetadata) {
              await handler.handleAntilink(sock, msg, groupMetadata);
            }
          } catch (error) {}
        }
      });
    }
  });

  sock.ev.on('message-receipt.update', () => {});
  sock.ev.on('messages.update', () => {});

  sock.ev.on('group-participants.update', async (update) => {
    await handler.handleGroupUpdate(sock, update);
  });

  sock.ev.on('error', (error) => {
    const statusCode = error?.output?.statusCode;
    if (statusCode === 515 || statusCode === 503 || statusCode === 408) {
      return;
    }
    console.error('Socket error:', error.message || error);
  });

  return sock;
}

// Start the bot
console.log('🚀 Starting WhatsApp MD Bot...\n');
console.log(`📦 Bot Name: ${config.botName}`);
console.log(`⚡ Prefix: ${config.prefix}`);
const ownerNames = Array.isArray(config.ownerName) ? config.ownerName.join(',') : config.ownerName;
console.log(`👑 Owner: ${ownerNames}\n`);
console.log(`🔑 Session Format: tmt~ (short & long support)`);
console.log(`🌐 24/7 Mode: Active (Render/Heroku compatible)\n`);

cleanupPuppeteerCache();

startBot().catch(err => {
  console.error('Error starting bot:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Keep-alive server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  if (err.code === 'ENOSPC' || err.errno === -28 || err.message?.includes('no space left on device')) {
    console.error('⚠️ ENOSPC Error: No space left on device. Attempting cleanup...');
    const { cleanupOldFiles } = require('./utils/cleanup');
    cleanupOldFiles();
    console.warn('⚠️ Cleanup completed. Bot will continue but may experience issues until space is freed.');
    return;
  }
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  if (err.code === 'ENOSPC' || err.errno === -28 || err.message?.includes('no space left on device')) {
    console.warn('⚠️ ENOSPC Error in promise: No space left on device. Attempting cleanup...');
    const { cleanupOldFiles } = require('./utils/cleanup');
    cleanupOldFiles();
    return;
  }
  if (err.message && err.message.includes('rate-overlimit')) {
    console.warn('⚠️ Rate limit reached. Please slow down your requests.');
    return;
  }
  console.error('Unhandled Rejection:', err);
});

module.exports = { store };
