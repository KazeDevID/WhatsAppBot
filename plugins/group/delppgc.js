/**
 * Plugin: Remove Group Profile Picture
 * Access: Admin & Superadmin (Bot must be admin)
 */

module.exports = {
  command: ['delppgc', 'hapusppgc', 'removeppgc'],
  tags: ['group'],
  help: ['delppgc'],
  description: 'Remove group profile picture',
  isGroup: true,
  isAdmin: true,
  isBotAdmin: true,

  run: async (m, { sock }) => {
    try {
      await sock.removeProfilePicture(m.chat);
      return m.reply('✅ *Group profile picture has been successfully removed.*');
    } catch (err) {
      return m.reply(`❌ Failed to remove group profile picture: ${err.message}`);
    }
  }
};

