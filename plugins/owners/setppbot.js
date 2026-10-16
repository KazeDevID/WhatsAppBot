/**
 * Plugin: Set Bot Standard Profile Picture
 * Access: Owner Only
 */

module.exports = {
  command: ['setpp', 'setppbot', 'setprofile'],
  tags: ['owners'],
  help: ['setppbot (reply image)'],
  description: 'Update bot profile picture with standard crop',
  isOwner: true,

  run: async (m, { sock }) => {
    let mediaMsg = null;

    if (m.quoted && (m.quoted.type === 'imageMessage' || m.quoted.message?.imageMessage)) {
      mediaMsg = m.quoted;
    } else if (m.type === 'imageMessage' || m.message?.imageMessage) {
      mediaMsg = m;
    }

    if (!mediaMsg) {
      return m.reply(
        `⚠️ *Usage Instructions:*\n\n` +
        `• Reply to an image with: \`.setppbot\`\n` +
        `• Or send an image with caption: \`.setppbot\`\n\n` +
        `_Note: For uncropped full profile picture, use \`.setpppanjang\`._`
      );
    }

    await m.reply('⏳ *Updating bot profile picture...*');

    try {
      let buffer = null;
      if (typeof mediaMsg.download === 'function') {
        buffer = await mediaMsg.download();
      }

      if (!buffer || buffer.length === 0) {
        return m.reply('❌ Failed to download the image.');
      }

      const botJid = sock.user?.id || sock.authState?.creds?.me?.id;
      await sock.updateProfilePicture(botJid, buffer);

      return m.reply('✅ *Bot profile picture successfully updated!*');
    } catch (err) {
      return m.reply(`❌ Failed to update bot profile picture: ${err.message}`);
    }
  }
};
