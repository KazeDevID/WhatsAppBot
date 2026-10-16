/**
 * Plugin: List Group Admins & Superadmin
 * Access: Group Members
 */

module.exports = {
  command: ['adminlist', 'listadmin'],
  tags: ['group'],
  help: ['adminlist'],
  description: 'View list of group admins and superadmin',
  isGroup: true,

  run: async (m, { sock, participants, groupMetadata }) => {
    const adminParticipants = participants.filter(p => p.admin);

    if (!adminParticipants.length) {
      return m.reply('⚠️ No admins detected in this group.');
    }

    let text = `🛡️ *GROUP ADMIN LIST*\n`;
    text += `Group: *${groupMetadata?.subject || 'Group'}*\n\n`;

    const mentions = [];

    adminParticipants.forEach((p, idx) => {
      const jid = sock.decodeJid(p.id);
      mentions.push(jid);
      const num = jid.replace(/[^0-9]/g, '').split('@')[0];
      const role = p.admin === 'superadmin' ? '👑 Creator (Superadmin)' : '⭐ Admin';
      text += `${idx + 1}. @${num} — *${role}*\n`;
    });

    return m.reply(text, null, { mentions });
  }
};

