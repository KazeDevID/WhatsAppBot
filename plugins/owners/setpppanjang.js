/**
 * Plugin: Set Bot Full Profile Picture (PP Panjang Bot)
 * Access: Owner Only
 * Description: Sets bot profile picture in full aspect ratio without square cropping
 */
const { setFullProfilePicture } = require('../../lib/image');

module.exports = {
  command: ['setpppanjang', 'setppfull', 'setppbotfull', 'setppbotpanjang'],
  tags: ['owners'],
  help: ['setpppanjang (reply/send image)'],
  description: 'Set bot full profile picture without square cropping (PP Panjang)',
  isOwner: true,

  run: async (m, { sock, text }) => {
    let mediaMsg = null;

    if (m.quoted && (m.quoted.type === 'imageMessage' || m.quoted.message?.imageMessage)) {
      mediaMsg = m.quoted;
    } else if (m.type === 'imageMessage' || m.message?.imageMessage) {
      mediaMsg = m;
    }

    if (!mediaMsg) {
      return m.reply(
        `⚠️ *Usage Instructions for PP Panjang (Full Profile):*\n\n` +
        `• Reply to any portrait or landscape image with: \`.setpppanjang\`\n` +
        `• Or send an image with caption: \`.setpppanjang\`\n` +
        `• Add \`--raw\` to use raw fitted mode without blurred background: \`.setpppanjang --raw\``
      );
    }

    await m.reply('⏳ *Processing full profile picture (PP Panjang)...*');

    try {
      let buffer = null;
      if (typeof mediaMsg.download === 'function') {
        buffer = await mediaMsg.download();
      }

      if (!buffer || buffer.length === 0) {
        return m.reply('❌ Failed to download the image. Please make sure the image is still accessible.');
      }

      const isRaw = text && text.includes('--raw');
      const botJid = sock.user?.id || sock.authState?.creds?.me?.id;

      await setFullProfilePicture(sock, botJid, buffer, {
        blurBackground: !isRaw,
        maxDimension: 640
      });

      return m.reply(
        `✅ *Bot Full Profile Picture (PP Panjang) successfully updated!*\n\n` +
        `• *Mode:* ${isRaw ? 'Raw Letterbox (Dark Frame)' : 'Aesthetic Blurred Frame'}\n` +
        `• *Resolution:* Standard Full Resolution (640x640)\n` +
        `• *Cropping:* 0% (Entire photo preserved without crop)`
      );
    } catch (err) {
      return m.reply(`❌ Failed to update bot full profile picture: ${err.message}`);
    }
  }
};
