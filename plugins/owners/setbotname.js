/**
 * Plugin: Set Bot WhatsApp Display Name
 * Access: Owner Only
 */

module.exports = {
  command: ['setbotname', 'setnamebot', 'botname'],
  tags: ['owners'],
  help: ['setbotname <new_name>'],
  description: 'Change WhatsApp bot profile display name',
  isOwner: true,

  run: async (m, { sock, text, config }) => {
    if (!text) {
      return m.reply(
        `⚠️ *Please specify the new bot name!*\n\n` +
        `• Example: \`.setbotname Zettai Assistant\`\n` +
        `• Current name: *${config.botName || 'Zettai Bot'}*`
      );
    }

    try {
      await sock.updateProfileName(text);
      config.botName = text;
      return m.reply(`✅ *Bot display name successfully changed to:* *${text}*`);
    } catch (err) {
      return m.reply(`❌ Failed to change bot display name: ${err.message}`);
    }
  }
};
