/**
 * Plugin: Hidetag / Hidden Mention to All Members
 * Access: Admin & Superadmin
 */

module.exports = {
  command: ['hidetag', 'h', 'notif'],
  tags: ['group'],
  help: ['hidetag <message>'],
  description: 'Send announcement with hidden tag to all group members',
  isGroup: true,
  isAdmin: true,

  run: async (m, { sock, text, participants }) => {
    const memberJids = participants.map(p => sock.decodeJid(p.id));

    if (!memberJids.length) {
      return m.reply('⚠️ No members found to mention.');
    }

    let messageText = text.trim();

    if (!messageText && m.quoted?.text) {
      messageText = m.quoted.text;
    }

    if (!messageText) {
      return m.reply('⚠️ Please provide an announcement message!\nExample: `.hidetag Team meeting tonight`');
    }

    await sock.sendMessage(m.chat, {
      text: messageText,
      mentions: memberJids
    }, { quoted: m });
  }
};

