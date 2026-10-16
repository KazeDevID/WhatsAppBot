/**
 * Group Helper Utilities & Target Resolver for WhatsApp Bot
 */

const { isJidGroup } = require('baileys');
const { getBotIdentifiers, registerJidPair } = require('./serialize');
const config = require('../config');

/**
 * Resolves a target user JID from mentions, quoted message, or text/number
 * @param {object} m Serialized message object
 * @param {string[]} args Command arguments
 * @param {string} text Raw text after command
 * @returns {{ jid: string|null, number: string|null, mention: string|null }}
 */
function getTarget(m, args = [], text = '') {
  if (m.mentionedJid && m.mentionedJid.length > 0) {
    const jid = m.mentionedJid[0];
    const number = jid.replace(/[^0-9]/g, '');
    return { jid, number, mention: `@${number}` };
  }

  if (m.quoted && m.quoted.sender) {
    const jid = m.quoted.sender;
    const number = jid.replace(/[^0-9]/g, '');
    return { jid, number, mention: `@${number}` };
  }

  const candidate = (args[0] || text || '').trim();
  if (candidate) {
    let cleaned = candidate.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    }
    if (cleaned.length >= 8 && cleaned.length <= 16) {
      const jid = `${cleaned}@s.whatsapp.net`;
      return { jid, number: cleaned, mention: `@${cleaned}` };
    }
  }

  if (!m.isGroup && m.chat && m.chat.endsWith('@s.whatsapp.net')) {
    const jid = m.fromMe ? m.chat : (m.sender || m.chat);
    const number = jid.replace(/[^0-9]/g, '');
    if (number) {
      return { jid, number, mention: `@${number}` };
    }
  }

  return { jid: null, number: null, mention: null };
}

const metadataCache = new Map();
const CACHE_TTL = 10000;

/**
 * Fetches group metadata with caching
 * @param {import('baileys').WASocket} sock
 * @param {string} groupId
 * @returns {Promise<object>}
 */
async function getGroupMetadata(sock, groupId) {
  const cached = metadataCache.get(groupId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  const data = await sock.groupMetadata(groupId);
  metadataCache.set(groupId, { data, timestamp: Date.now() });
  return data;
}

/**
 * Checks group permissions for sender and bot
 * @param {import('baileys').WASocket} sock
 * @param {object} m
 * @returns {Promise<object>}
 */
async function checkGroupPermissions(sock, m) {
  if (!m.isGroup) {
    return {
      groupMetadata: null,
      participants: [],
      groupAdmins: [],
      isAdmin: false,
      isSuperAdmin: false,
      isBotAdmin: false
    };
  }

  try {
    const groupMetadata = await getGroupMetadata(sock, m.chat);
    const participants = groupMetadata.participants || [];
    
    for (const p of participants) {
      if (p.id?.endsWith('@lid') && p.phoneNumber) {
        registerJidPair(p.id, `${p.phoneNumber.replace(/[^0-9]/g, '')}@s.whatsapp.net`);
      }
    }

    const botIds = getBotIdentifiers(sock);

    const groupAdmins = participants
      .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
      .map(p => sock.decodeJid(p.id));

    const isBotAdmin = participants.some(p => {
      const pJid = sock.decodeJid(p.id);
      const pDigits = pJid.replace(/[^0-9]/g, '').split('@')[0];
      const hasAdmin = p.admin === 'admin' || p.admin === 'superadmin';
      return hasAdmin && (botIds.has(pJid) || botIds.has(pDigits));
    });

    const isBotSuperAdmin = participants.some(p => {
      const pJid = sock.decodeJid(p.id);
      const pDigits = pJid.replace(/[^0-9]/g, '').split('@')[0];
      const isSuper = p.admin === 'superadmin';
      const isOwnerJid = groupMetadata.owner && (sock.decodeJid(groupMetadata.owner) === pJid || groupMetadata.owner.replace(/[^0-9]/g, '') === pDigits);
      return (isSuper || isOwnerJid) && (botIds.has(pJid) || botIds.has(pDigits));
    });

    const senderJid = sock.decodeJid(m.sender);
    const senderNum = senderJid.replace(/[^0-9]/g, '').split('@')[0];
    const rawParticipant = m.key?.participant ? sock.decodeJid(m.key.participant) : '';
    const rawPartNum = rawParticipant.replace(/[^0-9]/g, '').split('@')[0];

    const isSenderBot = Boolean(m.fromMe) ||
                        botIds.has(senderJid) ||
                        botIds.has(senderNum) ||
                        botIds.has(rawParticipant) ||
                        botIds.has(rawPartNum);

    const ownerList = (Array.isArray(config.owner) ? config.owner : [config.owner])
      .map(num => String(num).replace(/[^0-9]/g, ''))
      .filter(Boolean);
    const isSenderConfigOwner = ownerList.some(oNum => oNum && (senderNum.startsWith(oNum) || rawPartNum.startsWith(oNum)));

    let isAdmin = false;
    let isSuperAdmin = false;

    if (isSenderBot) {
      isAdmin = isBotAdmin || isBotSuperAdmin;
      isSuperAdmin = isBotSuperAdmin;
    } else if (isSenderConfigOwner) {
      isAdmin = true;
      isSuperAdmin = true;
    } else {
      const senderParticipant = participants.find(p => {
        const pJid = sock.decodeJid(p.id);
        const pNum = pJid.replace(/[^0-9]/g, '').split('@')[0];
        return pNum === senderNum || pJid === senderJid || (rawPartNum && pNum === rawPartNum);
      });

      isSuperAdmin = Boolean(
        (senderParticipant && senderParticipant.admin === 'superadmin') ||
        (groupMetadata.owner && (sock.decodeJid(groupMetadata.owner) === senderJid || groupMetadata.owner.replace(/[^0-9]/g, '') === senderNum))
      );

      isAdmin = Boolean(
        isSuperAdmin || (senderParticipant && (senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin'))
      );
    }

    return {
      groupMetadata,
      participants,
      groupAdmins,
      isAdmin,
      isSuperAdmin,
      isBotAdmin
    };
  } catch (err) {
    return {
      groupMetadata: null,
      participants: [],
      groupAdmins: [],
      isAdmin: false,
      isSuperAdmin: false,
      isBotAdmin: false,
      error: err.message
    };
  }
}

module.exports = {
  getTarget,
  getGroupMetadata,
  checkGroupPermissions
};
