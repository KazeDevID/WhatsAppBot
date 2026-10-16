/**
 * Plugin: Change Group Name / Subject
 * Access: Admin & Superadmin (Bot must be admin)
 */

module.exports = {
  command: ['setname', 'setsubject', 'gantinama'],
  tags: ['group'],
  help: ['setname <new_name>'],
  description: 'Change group subject/name',
  isGroup: true,
  isAdmin: true,
  isBotAdmin: true,

  run: async (m, { sock, text, groupMetadata }) => {
    const newName = text.trim();

    if (!newName) {
      return m.reply('⚠️ Please enter a new group name!\nExample: `.setname Community Discussion`');
    }

    if (newName.length > 100) {
      return m.reply('⚠️ Group name must be at most 100 characters!');
    }

    try {
      const oldName = groupMetadata?.subject || 'Group';
      await sock.groupUpdateSubject(m.chat, newName);
      return m.reply(`✅ *Group name successfully changed!*\n\n• From: *${oldName}*\n• To: *${newName}*`);
    } catch (err) {
      return m.reply(`❌ Failed to change group name: ${err.message}`);
    }
  }
};

