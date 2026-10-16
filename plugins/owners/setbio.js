/**
 * Plugin: Set Bot WhatsApp Bio / About Status
 * Access: Owner Only
 */

module.exports = {
  command: ['setbio', 'setabout', 'setstatus'],
  tags: ['owners'],
  help: ['setbio <text>'],
  description: 'Change WhatsApp bot About / Bio status text',
  isOwner: true,

  run: async (m, { sock, text }) => {
    if (!text) {
      return m.reply(
        `⚠️ *Please specify the new bio text!*\n\n` +
        `• Example: \`.setbio Active 24/7 | Fast & Reliable Assistant\`\n` +
        `• Max length: 139 characters`
      );
    }

    try {
      await sock.updateProfileStatus(text);
      return m.reply(`✅ *Bot WhatsApp About / Bio successfully updated!*\n\n• *New Bio:* "${text}"`);
    } catch (err) {
      return m.reply(`❌ Failed to update bot bio: ${err.message}`);
    }
  }
};
