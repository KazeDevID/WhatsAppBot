/**
 * Plugin: Delete Bot Profile Picture
 * Access: Owner Only
 */

module.exports = {
  command: ['delpp', 'delppbot', 'removeppbot'],
  tags: ['owners'],
  help: ['delppbot'],
  description: 'Remove current profile picture of the bot',
  isOwner: true,

  run: async (m, { sock }) => {
    try {
      const botJid = sock.user?.id || sock.authState?.creds?.me?.id;
      if (typeof sock.removeProfilePicture === 'function') {
        await sock.removeProfilePicture(botJid);
      } else {
        await sock.query({
          tag: 'iq',
          attrs: {
            to: 's.whatsapp.net',
            type: 'set',
            xmlns: 'w:profile:picture'
          }
        });
      }

      return m.reply('✅ *Bot profile picture has been successfully removed!*');
    } catch (err) {
      return m.reply(`❌ Failed to remove profile picture: ${err.message}`);
    }
  }
};
