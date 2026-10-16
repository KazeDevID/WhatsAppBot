/**
 * Plugin: Change Group Description
 * Access: Admin & Superadmin (Bot must be admin)
 */

module.exports = {
  command: ['setdesc', 'setdesk', 'gantidesk'],
  tags: ['group'],
  help: ['setdesc <new_description>'],
  description: 'Change the group description',
  isGroup: true,
  isAdmin: true,
  isBotAdmin: true,

  run: async (m, { sock, text }) => {
    let newDesc = text.trim();

    if (!newDesc && m.quoted?.text) {
      newDesc = m.quoted.text.trim();
    }

    if (!newDesc) {
      return m.reply(
        '⚠️ Please provide new group description text!\n\n' +
        '• Example: `.setdesc Welcome to our official group! Please follow the rules.`\n' +
        '• Or reply to a message with `.setdesc`'
      );
    }

    try {
      await sock.groupUpdateDescription(m.chat, newDesc);
      return m.reply(`✅ *Group description successfully updated!*\n\n📝 *New Description:*\n${newDesc}`);
    } catch (err) {
      return m.reply(`❌ Failed to update group description: ${err.message}`);
    }
  }
};

