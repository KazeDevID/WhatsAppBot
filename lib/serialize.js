/**
 * Baileys Message Serialization & Interactive Helper (Native Flow)
 */

const { 
  proto, 
  generateWAMessageFromContent, 
  downloadContentFromMessage, 
  generateMessageIDV2,
  isJidGroup
} = require('baileys');
const crypto = require('crypto');
const helpers = require('./helpers');

const jidPairs = new Map();
const sentMessageIds = new Set();

function trackSentMessageId(id) {
  if (!id) return;
  sentMessageIds.add(id);
  const timer = setTimeout(() => {
    sentMessageIds.delete(id);
  }, 120000);
  if (timer && typeof timer.unref === 'function') {
    timer.unref();
  }
}

function isBotSentMessage(id) {
  return Boolean(id && sentMessageIds.has(id));
}

function registerJidPair(lid, phone) {
  if (!lid || !phone) return;
  const decLid = String(lid).split(':')[0];
  const decPhone = String(phone).split(':')[0];
  if (decLid.endsWith('@lid') && decPhone.endsWith('@s.whatsapp.net')) {
    jidPairs.set(decLid, decPhone);
  }
}

function syncBotJidPairs(sock) {
  if (!sock) return;
  const phoneCandidate = sock.user?.id || sock.user?.jid || sock.authState?.creds?.me?.id;
  const lidCandidate = sock.user?.lid || sock.authState?.creds?.me?.lid;
  if (phoneCandidate && lidCandidate) {
    const cleanPhone = sock.decodeJid(phoneCandidate);
    const cleanLid = sock.decodeJid(lidCandidate);
    registerJidPair(cleanLid, cleanPhone);
  }
}

function getBotIdentifiers(sock) {
  const identifiers = new Set();
  const add = (id) => {
    if (!id) return;
    const dec = sock.decodeJid ? sock.decodeJid(id) : id;
    identifiers.add(dec);
    const digits = String(dec).replace(/[^0-9]/g, '').split('@')[0];
    if (digits) {
      identifiers.add(digits);
      identifiers.add(`${digits}@s.whatsapp.net`);
    }
  };

  add(sock?.user?.id);
  add(sock?.user?.jid);
  add(sock?.user?.lid);
  add(sock?.authState?.creds?.me?.id);
  add(sock?.authState?.creds?.me?.lid);
  return identifiers;
}

function resolvePhoneJid(sock, jid, key = {}) {
  let decoded = sock.decodeJid(jid);
  if (!decoded) return decoded;

  if (decoded.endsWith('@g.us') || decoded.endsWith('@broadcast') || decoded.endsWith('@newsletter')) {
    return decoded;
  }

  if (decoded.endsWith('@lid')) {
    const normalizedLid = decoded.split(':')[0];
    if (jidPairs.has(normalizedLid)) return jidPairs.get(normalizedLid);
    if (jidPairs.has(decoded)) return jidPairs.get(decoded);

    const myLid = sock.authState?.creds?.me?.lid || sock.user?.lid;
    const myPhone = sock.authState?.creds?.me?.id || sock.user?.id;
    if (myLid && myPhone) {
      const decMyLid = sock.decodeJid(myLid);
      if (decMyLid === decoded || decMyLid.split('@')[0] === decoded.split('@')[0]) {
        return sock.decodeJid(myPhone);
      }
    }

    if (key.participant?.endsWith('@lid') && key.participantAlt?.endsWith('@s.whatsapp.net')) {
      registerJidPair(sock.decodeJid(key.participant), sock.decodeJid(key.participantAlt));
      if (decoded === sock.decodeJid(key.participant)) return sock.decodeJid(key.participantAlt);
    }
    if (key.remoteJid?.endsWith('@lid') && key.remoteJidAlt?.endsWith('@s.whatsapp.net')) {
      registerJidPair(sock.decodeJid(key.remoteJid), sock.decodeJid(key.remoteJidAlt));
      if (decoded === sock.decodeJid(key.remoteJid)) return sock.decodeJid(key.remoteJidAlt);
    }
    return decoded;
  }
  return toJid(decoded);
}

function toJid(str) {
  if (!str) return str;
  if (str.endsWith('@g.us') || str.endsWith('@broadcast') || str.endsWith('@newsletter')) {
    return str;
  }
  let cleaned = str.replace(/[^0-9]/g, '');
  if (!cleaned) return str;
  if (cleaned.startsWith('0')) cleaned = '62' + cleaned.slice(1);
  return `${cleaned}@s.whatsapp.net`;
}

function getContentType(msg) {
  if (!msg) return '';
  const keys = Object.keys(msg);
  if (keys.length === 0) return '';
  const type = keys.find(k => k !== 'messageContextInfo' && k !== 'senderKeyDistributionMessage' && k !== 'protocolMessage');
  return type || keys[0];
}

function unwrapMessage(message) {
  if (!message) return { message: null, type: '' };
  let msg = message;
  let type = getContentType(msg);

  while (
    msg && (
      type === 'ephemeralMessage' ||
      type === 'viewOnceMessage' ||
      type === 'viewOnceMessageV2' ||
      type === 'viewOnceMessageV2Extension' ||
      type === 'documentWithCaptionMessage' ||
      type === 'deviceSentMessage' ||
      type === 'botForwardedMessage'
    )
  ) {
    if (type === 'deviceSentMessage') {
      msg = msg.deviceSentMessage?.message;
    } else if (type === 'documentWithCaptionMessage') {
      msg = msg.documentWithCaptionMessage?.message;
    } else if (type === 'botForwardedMessage') {
      msg = msg.botForwardedMessage?.message;
    } else {
      msg = msg[type]?.message;
    }
    type = getContentType(msg);
  }

  if (type === 'protocolMessage' && msg?.protocolMessage?.editedMessage) {
    msg = msg.protocolMessage.editedMessage;
    type = getContentType(msg);
  }

  return { message: msg, type };
}

function serialize(sock, m) {
  if (!m || !m.key) return m;

  syncBotJidPairs(sock);

  if (m.key.remoteJid?.endsWith('@lid') && m.key.remoteJidAlt?.endsWith('@s.whatsapp.net')) {
    registerJidPair(sock.decodeJid(m.key.remoteJid), sock.decodeJid(m.key.remoteJidAlt));
  }
  if (m.key.participant?.endsWith('@lid') && m.key.participantAlt?.endsWith('@s.whatsapp.net')) {
    registerJidPair(sock.decodeJid(m.key.participant), sock.decodeJid(m.key.participantAlt));
  }

  m.id = m.key.id || '';

  const botIds = getBotIdentifiers(sock);
  const rawParticipant = m.key.participant ? sock.decodeJid(m.key.participant) : '';
  const participantDigits = rawParticipant.replace(/[^0-9]/g, '').split('@')[0];
  const isFromMyAccount = Boolean(m.key.fromMe) ||
                          Boolean(rawParticipant && (botIds.has(rawParticipant) || botIds.has(participantDigits)));

  m.fromMe = isFromMyAccount;
  m.isBaileys = Boolean(m.id && isBotSentMessage(m.id));

  const rawRemoteJid = sock.decodeJid(m.key.remoteJid || '');
  m.chat = resolvePhoneJid(sock, rawRemoteJid, m.key);
  m.isGroup = m.chat.endsWith('@g.us');

  let rawSender = m.fromMe
    ? (sock.user?.id || sock.authState?.creds?.me?.id || m.key.participant || m.chat)
    : (m.key.participant || m.chat);
  rawSender = sock.decodeJid(rawSender);
  m.sender = resolvePhoneJid(sock, rawSender, m.key);
  if (m.sender && m.sender.endsWith('@g.us') && m.fromMe) {
    const fallbackMe = sock.user?.id || sock.authState?.creds?.me?.id;
    if (fallbackMe) m.sender = sock.decodeJid(fallbackMe);
  }

  m.pushName = m.pushName || 'Pengguna';

  if (m.message) {
    const unwrapped = unwrapMessage(m.message);
    m.message = unwrapped.message;
    m.type = unwrapped.type;

    if (!m.message) {
      m.body = '';
      return m;
    }

    m.msg = m.message[m.type] || m.message;
    m.body = '';

    if (m.type === 'conversation') {
      m.body = m.message.conversation;
    } else if (m.type === 'extendedTextMessage') {
      m.body = m.message.extendedTextMessage?.text || '';
    } else if (m.type === 'imageMessage') {
      m.body = m.message.imageMessage?.caption || '';
    } else if (m.type === 'videoMessage') {
      m.body = m.message.videoMessage?.caption || '';
    } else if (m.type === 'documentMessage') {
      m.body = m.message.documentMessage?.caption || '';
    } else if (m.type === 'interactiveResponseMessage') {
      const interactiveMsg = m.message.interactiveResponseMessage;
      if (interactiveMsg?.nativeFlowResponseMessage) {
        try {
          const params = JSON.parse(interactiveMsg.nativeFlowResponseMessage.paramsJson || '{}');
          m.selectedButtonId = params.id || params.row_id || params.selected_id || params.selectedRowId || interactiveMsg.nativeFlowResponseMessage.name;
          m.body = m.selectedButtonId || '';
        } catch {
          m.body = interactiveMsg.nativeFlowResponseMessage.name || '';
        }
      }
    } else if (m.type === 'templateButtonReplyMessage') {
      m.selectedButtonId = m.message.templateButtonReplyMessage.selectedId;
      m.body = m.selectedButtonId || '';
    } else if (m.type === 'buttonsResponseMessage') {
      m.selectedButtonId = m.message.buttonsResponseMessage.selectedButtonId;
      m.body = m.selectedButtonId || '';
    } else if (m.type === 'listResponseMessage') {
      m.selectedButtonId = m.message.listResponseMessage.singleSelectReply?.selectedRowId;
      m.body = m.selectedButtonId || '';
    } else if (m.type === 'richResponseMessage') {
      const rich = m.message.richResponseMessage || m.message;
      const texts = [];
      if (rich.submessages && Array.isArray(rich.submessages)) {
        for (const sub of rich.submessages) {
          if (sub.messageText) texts.push(sub.messageText);
          if (sub.tableMetadata?.title) texts.push(`[Tabel: ${sub.tableMetadata.title}]`);
          if (sub.codeMetadata?.codeBlocks) {
            texts.push(sub.codeMetadata.codeBlocks.map(c => c.codeContent).join(''));
          }
        }
      }
      m.body = texts.join('\n') || '';
    }

    const contextInfo = m.msg?.contextInfo;
    m.mentionedJid = contextInfo?.mentionedJid || [];

    if (contextInfo?.quotedMessage) {
      const qUnwrapped = unwrapMessage(contextInfo.quotedMessage);
      const qMsg = qUnwrapped.message;
      const qType = qUnwrapped.type;

      if (qMsg) {
        m.quoted = {
          key: {
            remoteJid: m.chat,
            fromMe: contextInfo.participant === sock.decodeJid(sock.user?.id),
            id: contextInfo.stanzaId,
            participant: contextInfo.participant
          },
          message: qMsg,
          type: qType,
          sender: sock.decodeJid(contextInfo.participant || m.chat),
          fromMe: contextInfo.participant === sock.decodeJid(sock.user?.id),
          text: qMsg.conversation || qMsg.extendedTextMessage?.text || qMsg[qType]?.caption || '',
          download: async () => {
            const stream = await downloadContentFromMessage(qMsg[qType], qType.replace('Message', ''));
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            return buffer;
          }
        };
      } else {
        m.quoted = null;
      }
    } else {
      m.quoted = null;
    }

    if (m.type && m.type.endsWith('Message') && m.type !== 'conversation' && m.type !== 'extendedTextMessage' && m.msg) {
      m.download = async () => {
        const stream = await downloadContentFromMessage(m.msg, m.type.replace('Message', ''));
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        return buffer;
      };
    }
  }

  m.reply = async (text, quoted = m, options = {}) => {
    let target = m.chat;
    if (target.endsWith('@lid')) {
      target = resolvePhoneJid(sock, target, m.key);
    }

    let safeQuoted = quoted;
    if (quoted && quoted.key) {
      const isGroupChat = target.endsWith('@g.us');
      let quotedParticipant = quoted.key.participant || quoted.sender || undefined;

      if (isGroupChat) {
        if (quoted.key.fromMe) {
          quotedParticipant = sock.decodeJid(sock.user?.id || sock.authState?.creds?.me?.id || '') || undefined;
        } else if (quotedParticipant && quotedParticipant.endsWith('@g.us')) {
          quotedParticipant = undefined;
        }
      }

      safeQuoted = {
        key: {
          remoteJid: target,
          id: quoted.key.id,
          fromMe: Boolean(quoted.key.fromMe),
          participant: quotedParticipant
        },
        message: quoted.message || { conversation: typeof text === 'string' ? text : 'Reply' }
      };
    }

    try {
      return await sock.sendMessage(target, { text, ...options }, { quoted: safeQuoted });
    } catch {
      return await sock.sendMessage(target, { text, ...options });
    }
  };

  m.react = (emoji) => {
    let target = m.chat;
    if (target.endsWith('@lid')) {
      target = resolvePhoneJid(sock, target, m.key);
    }
    return sock.sendMessage(target, { react: { text: emoji, key: m.key } });
  };

  m.sendInteractive = (data) => sock.sendInteractive(m.chat, data, m);
  m.sendRichMessage = (submessages, options = {}) => sock.sendRichMessage(m.chat, submessages, m, options);
  m.sendLink = (text, links, options = {}) => sock.sendLink(m.chat, text, links, m, options);
  m.sendLinkV2 = (text, links, options = {}) => sock.sendLinkV2(m.chat, text, links, m, options);
  m.sendTable = (title, headers, rows, options = {}) => sock.sendTable(m.chat, title, headers, rows, m, options);
  m.sendTableV2 = (table, options = {}) => sock.sendTableV2(m.chat, table, m, options);
  m.sendCodeBlock = (code, options = {}) => sock.sendCodeBlock(m.chat, code, m, options);
  m.sendCodeBlockV2 = (code, options = {}) => sock.sendCodeBlockV2(m.chat, code, m, options);
  m.sendList = (title, items, options = {}) => sock.sendList(m.chat, title, items, m, options);

  return m;
}

function extendSocket(sock) {
  const originalSendMessage = sock.sendMessage.bind(sock);
  sock.sendMessage = async (jid, content, options = {}) => {
    const res = await originalSendMessage(jid, content, options);
    if (res?.key?.id) trackSentMessageId(res.key.id);
    return res;
  };

  const originalRelayMessage = sock.relayMessage.bind(sock);
  sock.relayMessage = async (jid, message, options = {}) => {
    if (options?.messageId) trackSentMessageId(options.messageId);
    const res = await originalRelayMessage(jid, message, options);
    return res;
  };

  const originalDecodeJid = sock.decodeJid;
  sock.decodeJid = (jid) => {
    if (!jid) return jid;
    let decoded = jid;
    if (originalDecodeJid) {
      try { decoded = originalDecodeJid(jid); } catch {}
    }
    if (/:\d+@/gi.test(decoded)) {
      decoded = decoded.replace(/:\d+@/gi, '@');
    }
    return decoded;
  };

  function buildNativeFlowBinaryNodes(buttons = [], isGroup = false) {
    const randomHex = crypto.randomBytes(20).toString('hex');
    const qualityContent = {
      tag: 'quality_control',
      attrs: {
        decision_id: randomHex,
        source_type: 'third_party'
      },
      content: [{ tag: 'decision_source', attrs: { value: 'df' } }]
    };
    
    const bizAttributes = {
      actual_actors: '2',
      host_storage: '2',
      privacy_mode_ts: `${Date.now() / 1000 | 0}`
    };

    const nodes = [{
      tag: 'biz',
      attrs: bizAttributes,
      content: [
        {
          tag: 'interactive',
          attrs: { type: 'native_flow', v: '1' },
          content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
        },
        qualityContent
      ]
    }];

    if (!isGroup) {
      nodes.push({ tag: 'bot', attrs: { biz_bot: '1' } });
    }

    return nodes;
  }

  sock.sendInteractive = async (jid, options = {}, quoted = null) => {
    let targetJid = resolvePhoneJid(sock, jid, quoted?.key || {});
    const isGroup = isJidGroup(targetJid);
    const {
      title = '',
      subtitle = '',
      body = '',
      footer = '',
      listSections = null,
      sections = null,
      listTitle = '',
      display_text = ''
    } = options;

    let buttonList = Array.isArray(options.buttons) ? [...options.buttons] : [];

    const resolvedListSections = listSections || sections;
    if (resolvedListSections && Array.isArray(resolvedListSections) && resolvedListSections.length > 0) {
      const alreadyHasList = buttonList.some(b => b.type === 'single_select' || b.name === 'single_select' || b.type === 'list' || b.name === 'list');
      if (!alreadyHasList) {
        buttonList.unshift({
          name: 'single_select',
          title: listTitle || display_text || '📋 PILIH MENU',
          sections: resolvedListSections
        });
      }
    }

    let cleanQuoted = null;
    if (quoted && quoted.key) {
      let qPart = quoted.key.participant || quoted.sender;
      if (targetJid.endsWith('@g.us')) {
        if (quoted.key.fromMe) {
          qPart = sock.decodeJid(sock.user?.id || sock.authState?.creds?.me?.id || '') || undefined;
        } else if (qPart && qPart.endsWith('@g.us')) {
          qPart = undefined;
        }
      }
      cleanQuoted = {
        key: {
          remoteJid: targetJid,
          id: quoted.key.id,
          fromMe: Boolean(quoted.key.fromMe),
          participant: qPart
        },
        message: quoted.message || { conversation: body || 'Interactive' }
      };
    }

    let fallbackText = '';
    if (title) fallbackText += `*${title}*\n`;
    if (subtitle) fallbackText += `_${subtitle}_\n`;
    if (title || subtitle) fallbackText += `\n`;
    if (body) fallbackText += `${body}\n`;

    if (resolvedListSections && resolvedListSections.length > 0) {
      for (const sec of resolvedListSections) {
        if (sec.title) fallbackText += `\n*─── ${sec.title} ───*\n`;
        if (Array.isArray(sec.rows)) {
          for (const row of sec.rows) {
            fallbackText += `• *${row.title}*${row.description ? ` - _${row.description}_` : ''}\n`;
          }
        }
      }
    }

    const nonListButtons = buttonList.filter(b => b.name !== 'single_select' && b.type !== 'single_select' && b.name !== 'list' && b.type !== 'list');
    if (nonListButtons.length > 0) {
      fallbackText += `\n*─── Pilihan ───*\n`;
      for (const btn of nonListButtons) {
        const btnLabel = btn.display_text || btn.title || btn.id || 'Tombol';
        const btnCmd = btn.id || btnLabel;
        fallbackText += `• *${btnLabel}* (${btnCmd})\n`;
      }
    }
    if (footer) fallbackText += `\n_${footer}_`;

    const nativeButtons = buttonList.map((b, idx) => {
      let buttonName = b.type || b.name || 'quick_reply';
      let existingParams = {};
      if (b.buttonParamsJson) {
        try {
          existingParams = typeof b.buttonParamsJson === 'string' ? JSON.parse(b.buttonParamsJson) : b.buttonParamsJson;
        } catch {}
      }

      let buttonParamsJson = {};
      
      if (buttonName === 'open_webview' || buttonName === 'cta_url' || buttonName === 'url') {
        buttonName = 'cta_url';
        const targetUrl = b.url || b.link || existingParams.url || 'https://google.com';
        buttonParamsJson = {
          display_text: b.title || b.display_text || existingParams.display_text || 'Open Link',
          url: targetUrl,
          merchant_url: b.merchant_url || existingParams.merchant_url || targetUrl,
          webview_interaction: b.webview_interaction !== undefined ? Boolean(b.webview_interaction) : (existingParams.webview_interaction !== undefined ? Boolean(existingParams.webview_interaction) : true),
          ...(existingParams || {}),
          ...(b.options || {})
        };
      } else if (buttonName === 'cta_call' || buttonName === 'call') {
        buttonName = 'cta_call';
        buttonParamsJson = {
          display_text: b.title || b.display_text || existingParams.display_text || 'Telephone',
          phone: b.phone || existingParams.phone || '6281234567890'
        };
      } else if (buttonName === 'cta_copy' || buttonName === 'copy') {
        buttonName = 'cta_copy';
        buttonParamsJson = {
          display_text: b.title || b.display_text || existingParams.display_text || 'Copy',
          id: b.id || b.copy_code || existingParams.id || existingParams.copy_code || `copy_${idx}`,
          copy_code: b.copy_code || b.id || existingParams.copy_code || existingParams.id || 'COPY_ME'
        };
      } else if (buttonName === 'single_select' || buttonName === 'list') {
        buttonName = 'single_select';
        buttonParamsJson = {
          title: b.title || b.display_text || existingParams.title || listTitle || 'Pilih Opsi',
          sections: b.sections || b.listSections || existingParams.sections || []
        };
      } else {
        buttonName = 'quick_reply';
        buttonParamsJson = {
          display_text: b.title || b.display_text || existingParams.display_text || 'Reply',
          id: b.id || existingParams.id || `btn_${idx}`
        };
      }
      
      return {
        name: buttonName,
        buttonParamsJson: JSON.stringify(buttonParamsJson)
      };
    });

    const interactiveMessage = {
      header: title ? { title, subtitle, hasMediaAttachment: false } : undefined,
      body: { text: body },
      footer: footer ? { text: footer } : undefined,
      nativeFlowMessage: {
        buttons: nativeButtons,
        messageParamsJson: ''
      }
    };

    const useViewOnce = options.viewOnce !== undefined ? Boolean(options.viewOnce) : !isGroup;

    const contentPayload = useViewOnce ? {
      viewOnceMessage: {
        message: {
          messageContextInfo: proto.MessageContextInfo.create({
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
          }),
          interactiveMessage
        }
      }
    } : {
      interactiveMessage
    };

    const userJid = sock.authState?.creds?.me?.id || sock.user?.id;
    let fullMsg = generateWAMessageFromContent(targetJid, contentPayload, {
      logger: sock.logger,
      userJid,
      messageId: generateMessageIDV2 ? generateMessageIDV2(userJid) : undefined,
      timestamp: new Date(),
      quoted: cleanQuoted || undefined
    });

    const additionalNodes = [
      ...buildNativeFlowBinaryNodes(nativeButtons, isGroup),
      ...(Array.isArray(options.additionalNodes) ? options.additionalNodes : [])
    ];

    try {
      await sock.relayMessage(targetJid, fullMsg.message, {
        messageId: fullMsg.key.id,
        additionalNodes,
        ...options
      });
      return fullMsg;
    } catch (err) {
      console.warn('[Interactive Relay Warning]', err?.message || err);
      try {
        return await sock.sendMessage(targetJid, { text: fallbackText.trim() }, { quoted: cleanQuoted || undefined });
      } catch {
        return await sock.sendMessage(targetJid, { text: fallbackText.trim() });
      }
    }
  };

  sock.sendRichMessage = async (jid, submessages, quoted = null, options = {}) => {
    let targetJid = resolvePhoneJid(sock, jid, quoted?.key || {});
    const content = helpers.generateRichMessageContent(submessages, quoted, options);
    return await sock.relayMessage(targetJid, content.message, {
      messageId: content.messageId,
      ...options
    });
  };

  sock.sendTable = async (jid, title, headers, rows, quoted = null, options = {}) => {
    let targetJid = resolvePhoneJid(sock, jid, quoted?.key || {});
    const content = helpers.generateTableContent(title, headers, rows, quoted, options);
    return await sock.relayMessage(targetJid, content.message, {
      messageId: content.messageId,
      ...options
    });
  };

  sock.sendTableV2 = async (jid, table, quoted = null, options = {}) => {
    let targetJid = resolvePhoneJid(sock, jid, quoted?.key || {});
    const content = helpers.generateTableContentV2(table, quoted, options);
    return await sock.relayMessage(targetJid, content.message, {
      messageId: content.messageId,
      ...options
    });
  };

  sock.sendList = async (jid, title, items, quoted = null, options = {}) => {
    let targetJid = resolvePhoneJid(sock, jid, quoted?.key || {});
    const content = helpers.generateListContent(title, items, quoted, options);
    return await sock.relayMessage(targetJid, content.message, {
      messageId: content.messageId,
      ...options
    });
  };

  sock.sendCodeBlock = async (jid, code, quoted = null, options = {}) => {
    let targetJid = resolvePhoneJid(sock, jid, quoted?.key || {});
    const content = helpers.generateCodeBlockContent(code, quoted, options);
    return await sock.relayMessage(targetJid, content.message, {
      messageId: content.messageId,
      ...options
    });
  };

  sock.sendCodeBlockV2 = async (jid, code, quoted = null, options = {}) => {
    let targetJid = resolvePhoneJid(sock, jid, quoted?.key || {});
    const content = helpers.generateCodeBlockContentV2(code, quoted, options);
    return await sock.relayMessage(targetJid, content.message, {
      messageId: content.messageId,
      ...options
    });
  };

  sock.sendLink = async (jid, text, links, quoted = null, options = {}) => {
    let targetJid = resolvePhoneJid(sock, jid, quoted?.key || {});
    const content = helpers.generateLinkContent(text, links, quoted, options);
    return await sock.relayMessage(targetJid, content.message, {
      messageId: content.messageId,
      ...options
    });
  };

  sock.sendLinkV2 = async (jid, text, links, quoted = null, options = {}) => {
    let targetJid = resolvePhoneJid(sock, jid, quoted?.key || {});
    const content = helpers.generateLinkContentV2(text, links, quoted, options);
    return await sock.relayMessage(targetJid, content.message, {
      messageId: content.messageId,
      ...options
    });
  };

  sock.sendLatex = async (jid, quoted = null, options = {}) => {
    let targetJid = resolvePhoneJid(sock, jid, quoted?.key || {});
    const content = helpers.generateLatexContent(quoted, options);
    return await sock.relayMessage(targetJid, content.message, {
      messageId: content.messageId,
      ...options
    });
  };

  sock.sendUnifiedResponse = async (jid, quoted = null, captured = {}, options = {}) => {
    let targetJid = resolvePhoneJid(sock, jid, quoted?.key || {});
    const content = helpers.generateUnifiedResponseContent(quoted, captured, options);
    return await sock.relayMessage(targetJid, content.message, {
      messageId: content.messageId,
      ...options
    });
  };

  sock.captureUnifiedResponse = helpers.captureUnifiedResponse;

  sock.richMessage = () => new helpers.AIRich(sock);
  sock.airich = () => new helpers.AIRich(sock);
  sock.Rich = () => new helpers.Rich(sock);
  sock.buttonBuilder = () => new helpers.Button(sock);
  sock.buttonV2Builder = () => new helpers.ButtonV2(sock);
  sock.carouselBuilder = () => new helpers.Carousel(sock);
}

module.exports = {
  toJid,
  serialize,
  extendSocket,
  unwrapMessage,
  registerJidPair,
  syncBotJidPairs,
  getBotIdentifiers,
  trackSentMessageId,
  isBotSentMessage,
  ...helpers
};
