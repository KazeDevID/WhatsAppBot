/**
 * Plugin: Tag All Group Members
 * Access: Admin & Superadmin
 */

module.exports = {
  command: ['tagall', 'semua'],
  tags: ['group'],
  help: ['tagall <message>'],
  description: 'Mention all group members in a structured list',
  isGroup: true,
  isAdmin: true,

  run: async (m, { sock, text, participants, groupMetadata }) => {
    const memberJids = participants.map(p => sock.decodeJid(p.id));

    if (!memberJids.length) {
      return m.reply('⚠️ No members found to mention.');
    }

    const groupName = groupMetadata?.subject || 'Group';
    const customMessage = text ? text.trim() : 'Attention to all group members!';

    let output = `📢 *TAG ALL — ${groupName.toUpperCase()}*\n`;
    output += `💬 *Message:* ${customMessage}\n`;
    output += `👥 *Total Members:* ${memberJids.length}\n\n`;

    memberJids.forEach((jid, index) => {
      const num = jid.replace(/[^0-9]/g, '').split('@')[0];
      output += `${index + 1}. @${num}\n`;
    });

    output += `\n_Automated message sent by Group Admin._`;

    await sock.sendMessage(m.chat, {
      text: output,
      mentions: memberJids
    }, { quoted: m });
  }
};

