/**
 * Plugin: Set Group Profile Picture
 * Access: Admin & Superadmin (Bot must be admin)
 */

module.exports = {
  command: ['setppgc', 'seticongc', 'setppgroup'],
  tags: ['group'],
  help: ['setppgc (reply image)'],
  description: 'Change group profile picture from sent or quoted image',
  isGroup: true,
  isAdmin: true,
  isBotAdmin: true,

  run: async (m, { sock }) => {
    let mediaMsg = null;

    if (m.quoted && (m.quoted.type === 'imageMessage' || m.quoted.message?.imageMessage)) {
      mediaMsg = m.quoted;
    } else if (m.type === 'imageMessage' || m.message?.imageMessage) {
      mediaMsg = m;
    }

    if (!mediaMsg) {
      return m.reply(
        '⚠️ *Please send or reply to an image!*\n\n' +
        '• Reply to a photo in the group with `.setppgc`\n' +
        '• Or send an image with caption `.setppgc`'
      );
    }

    await m.reply('⏳ Processing and updating group profile picture...');

    try {
      let buffer = null;
      if (typeof mediaMsg.download === 'function') {
        buffer = await mediaMsg.download();
      }

      if (!buffer || buffer.length === 0) {
        return m.reply('❌ Failed to download image. Make sure the image is still accessible.');
      }

      await sock.updateProfilePicture(m.chat, buffer);
      return m.reply('✅ *Group profile picture successfully updated!*');
    } catch (err) {
      return m.reply(`❌ Failed to update group profile picture: ${err.message}`);
    }
  }
};

