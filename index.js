/**
 * WhatsApp Bot Main Entry
 */
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} = require('baileys');

const pino = require('pino');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const config = require('./config');
const { logger } = require('./lib/logger');
const { serialize, extendSocket, isBotSentMessage, syncBotJidPairs } = require('./lib/serialize');
const { plugins, loadPlugins, watchPlugins, handleCommand } = require('./lib/plugins');

const pluginDir = path.join(__dirname, 'plugins');
loadPlugins(pluginDir);
watchPlugins(pluginDir);

const { createDashboardServer } = require('./lib/server');

const botState = {
  status: 'initializing',
  pairingCode: null,
  qr: null,
  version: null,
  user: null,
  sock: null
};

async function requestPairingCode(number) {
  if (!botState.sock) {
    throw new Error('Bot socket is still initializing, please try again in a few seconds.');
  }
  const cleanNumber = String(number).replace(/[^0-9]/g, '');
  if (!cleanNumber) {
    throw new Error('Invalid phone number provided.');
  }
  config.botNumber = cleanNumber;
  botState.status = 'pairing';
  const code = await botState.sock.requestPairingCode(cleanNumber);
  botState.pairingCode = code;
  logger.pairing(code);
  return { success: true, pairingCode: code };
}

async function runTestCommand(commandText) {
  if (!commandText) return 'No command provided';
  const replies = [];
  const mockNum = config.owner[0] ? String(config.owner[0]).replace(/[^0-9]/g, '') : '6282217590187';
  const mockSender = `${mockNum}@s.whatsapp.net`;
  const mockM = {
    key: { remoteJid: mockSender, fromMe: true, id: 'TEST_' + Date.now() },
    chat: mockSender,
    sender: mockSender,
    pushName: config.ownerName || 'Owner',
    isGroup: false,
    fromMe: true,
    body: commandText,
    reply: async (text) => {
      replies.push(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
      return { key: { id: 'REPLY' } };
    }
  };

  const activeSock = botState.sock || {
    user: { id: `${mockNum}:0@s.whatsapp.net` },
    relayMessage: async () => ({}),
    sendMessage: async (jid, content, options) => {
      replies.push(`[Sent to ${jid}] ` + (content?.text || JSON.stringify(content)));
      return { key: { id: 'TEST_MSG_' + Date.now() } };
    },
    updateBlockStatus: async (jid, action) => {
      replies.push(`[Block Status] ${action} -> ${jid}`);
      return { success: true };
    },
    decodeJid: (j) => j,
    sendInteractive: async (jid, content, m) => {
      const text = content?.body || content?.text || JSON.stringify(content);
      if (m && m.reply) await m.reply(text);
    }
  };

  await handleCommand(activeSock, mockM, config);
  return replies.length ? replies.join('\n\n') : 'Command processed successfully.';
}

createDashboardServer({
  config,
  plugins,
  getBotState: () => botState,
  requestPairingCode,
  runTestCommand
});

async function startBot() {
  const connSpinner = logger.createSpinner('Connecting.....');
  connSpinner.start();
  
  const sessionPath = path.join(__dirname, config.sessionName);
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  botState.version = version;
  connSpinner.update(`Checking out the Baileys version v${version.join('.')}...`);
  
  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: config.authMode === 'qr',
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }))
    },
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    generateHighQualityLinkPreview: true,
    syncFullHistory: false
  });

  botState.sock = sock;
  extendSocket(sock);

  if (config.authMode === 'pairing' && !sock.authState.creds.registered) {
    if (!config.botNumber) {
      botState.status = 'waiting_number';
      connSpinner.warn('botNumber is not set in config.js for pairing mode!');
    } else {
      botState.status = 'pairing';
      const pairSpinner = logger.createSpinner('Requesting pairing code...');
      pairSpinner.start();
      setTimeout(async () => {
        try {
          const cleanNumber = config.botNumber.replace(/[^0-9]/g, '');
          const pairingCode = await sock.requestPairingCode(cleanNumber);
          botState.pairingCode = pairingCode;
          pairSpinner.succeed('Pairing code successfully obtained!');
          logger.pairing(pairingCode);
        } catch (err) {
          pairSpinner.fail(`Failed to request pairing code: ${err.message}`);
        }
      }, 3000);
    }
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr && config.authMode === 'qr') {
      botState.qr = qr;
      botState.status = 'qr';
      connSpinner.succeed('Please scan the QR code below:');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      botState.status = 'reconnecting';
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      connSpinner.fail(`Connection lost (Status: ${statusCode}). Reconnect: ${shouldReconnect}`);
      if (shouldReconnect) {
        startBot();
      } else {
        logger.error('Session', new Error('Session Logged Out. Please delete the session folder and rescan/pair.'));
      }
    } else if (connection === 'open') {
      botState.status = 'connected';
      botState.user = sock.user;
      connSpinner.succeed(`WhatsApp socket is connected stable!`);
      syncBotJidPairs(sock);
      const botNum = sock.user.id.split(':')[0].replace(/[^0-9]/g, '');
      if (botNum && !config.owner.includes(botNum)) {
        config.owner.push(botNum);
      }
      logger.banner({
        botName: config.botName,
        version: version.join('.'),
        mode: config.selfMode ? 'Self (Owner Only)' : 'Public (All Users)',
        pluginCount: plugins.size
      });
      logger.info(`Connected as: ${sock.user.id} (+${botNum})`);
      logger.info(`Bot is ready to receive commands!`);
    }
  });

  sock.ev.on('creds.update', () => {
    saveCreds();
    syncBotJidPairs(sock);
  });

  config.contacts = config.contacts || new Set();
  config.recentChats = config.recentChats || new Set();

  sock.ev.on('contacts.upsert', (contacts) => {
    if (!Array.isArray(contacts)) return;
    for (const c of contacts) {
      if (c.id && c.id.endsWith('@s.whatsapp.net')) {
        config.contacts.add(c.id);
      }
    }
  });

  sock.ev.on('contacts.update', (updates) => {
    if (!Array.isArray(updates)) return;
    for (const c of updates) {
      if (c.id && c.id.endsWith('@s.whatsapp.net')) {
        config.contacts.add(c.id);
      }
    }
  });

  sock.ev.on('chats.upsert', (chats) => {
    if (!Array.isArray(chats)) return;
    for (const c of chats) {
      if (c.id && c.id.endsWith('@s.whatsapp.net')) {
        config.contacts.add(c.id);
      }
    }
  });

  sock.ev.on('messaging-history.set', ({ chats, contacts }) => {
    if (Array.isArray(contacts)) {
      for (const c of contacts) {
        if (c.id && c.id.endsWith('@s.whatsapp.net')) {
          config.contacts.add(c.id);
        }
      }
    }
    if (Array.isArray(chats)) {
      for (const c of chats) {
        if (c.id && c.id.endsWith('@s.whatsapp.net')) {
          config.contacts.add(c.id);
        }
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (!messages || !messages.length) return;
    for (const rawMsg of messages) {
      if (!rawMsg.message) continue;
      if (rawMsg.key?.remoteJid === 'status@broadcast') continue;
      try {
        const m = serialize(sock, rawMsg);
        if (!m) continue;

        if (m.sender && m.sender.endsWith('@s.whatsapp.net')) {
          config.contacts.add(m.sender);
        }
        if (m.chat && m.chat.endsWith('@s.whatsapp.net')) {
          config.contacts.add(m.chat);
        }

        if (m.id && isBotSentMessage(m.id)) continue;

        const prefixes = Array.isArray(config.prefix) ? config.prefix : [config.prefix];
        const isPrefixed = m.body && prefixes.some(p => m.body.startsWith(p));
        if (m.isBaileys && !isPrefixed) continue;
        
        const chatType = m.isGroup ? 'Grup' : 'Private';
        if (!m.isGroup && m.sender && m.sender.endsWith('@s.whatsapp.net')) {
          config.recentChats.add(m.sender);
        }
        logger.message({
          sender: m.sender,
          pushName: m.pushName,
          chatType,
          body: m.body,
          fromMe: m.fromMe
        });
        
        await handleCommand(sock, m, config);
      } catch (err) {
        logger.error('Message Upsert', err);
      }
    }
  });
  return sock;
}
startBot().catch(err => {
  logger.error('Fatal Startup', err);
});
