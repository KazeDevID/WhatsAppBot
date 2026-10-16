/**
 * Plugin: Set Group Full Profile Picture (PP Panjang Grup)
 * Access: Group Admins & Bot Owner (Bot must be admin)
 * Description: Changes group icon to full aspect ratio without square cropping
 */
const { setFullProfilePicture } = require('../../lib/image');

module.exports = {
  command: ['setpppanjanggc', 'setppgcfull', 'setppgrouppanjang', 'setppfullgc'],
  tags: ['group'],
  help: ['setpppanjanggc (reply image)'],
  description: 'Set group full profile picture without square cropping for admins and owner',
  isGroup: true,
  isAdmin: true,
  isBotAdmin: true,

  run: async (m, { sock, text }) => {
    let mediaMsg = null;

    if (m.quoted && (m.quoted.type === 'imageMessage' || m.quoted.message?.imageMessage)) {
      mediaMsg = m.quoted;
    } else if (m.type === 'imageMessage' || m.message?.imageMessage) {
      mediaMsg = m;
    }

    if (!mediaMsg) {
      return m.reply(
        `⚠️ *Usage Instructions for Group PP Panjang:*\n\n` +
        `• Reply to a portrait or landscape photo with: \`.setpppanjanggc\`\n` +
        `• Or send an image with caption: \`.setpppanjanggc\`\n` +
        `• Add \`--raw\` to disable aesthetic blur frame: \`.setpppanjanggc --raw\``
      );
    }

    await m.reply('⏳ *Processing group full profile picture (PP Panjang)...*');

    try {
      let buffer = null;
      if (typeof mediaMsg.download === 'function') {
        buffer = await mediaMsg.download();
      }

      if (!buffer || buffer.length === 0) {
        return m.reply('❌ Failed to download the image. Please make sure the image is still accessible.');
      }

      const isRaw = text && text.includes('--raw');

      await setFullProfilePicture(sock, m.chat, buffer, {
        blurBackground: !isRaw,
        maxDimension: 640
      });

      return m.reply(
        `✅ *Group Full Profile Picture (PP Panjang) successfully updated!*\n\n` +
        `• *Group:* ${m.chat}\n` +
        `• *Mode:* ${isRaw ? 'Raw Letterbox (Dark Frame)' : 'Aesthetic Blurred Frame'}\n` +
        `• *Cropping:* None (Entire photo displayed)\n` +
        `• *Updated by:* @${(m.sender || '').split('@')[0]}`,
        m,
        { mentions: [m.sender] }
      );
    } catch (err) {
      return m.reply(`❌ Failed to update group profile picture: ${err.message}`);
    }
  }
};
