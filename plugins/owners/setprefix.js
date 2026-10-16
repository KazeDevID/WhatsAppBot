/**
 * Plugin: Set Bot Prefix
 * Access: Owner Only
 */

module.exports = {
  command: ['setprefix', 'prefix', 'changeprefix'],
  tags: ['owners'],
  help: ['setprefix <prefixes...>'],
  description: 'Change or set custom bot command prefixes dynamically',
  isOwner: true,

  run: async (m, { text, config }) => {
    if (!text) {
      const current = Array.isArray(config.prefix) ? config.prefix.join(' ') : config.prefix;
      return m.reply(
        `⚠️ *Usage Instructions for Set Prefix:*\n\n` +
        `• Current Prefix: \`[ ${current} ]\`\n` +
        `• Set single prefix: \`.setprefix !\`\n` +
        `• Set multiple prefixes: \`.setprefix . # ! /\`\n` +
        `• Reset to default: \`.setprefix reset\``
      );
    }

    if (text.trim().toLowerCase() === 'reset') {
      config.prefix = ['.', '#', '!', '/'];
      return m.reply(`✅ *Prefix reset to default:* \`[ ${config.prefix.join(' ')} ]\``);
    }

    const newPrefixes = text.trim().split(/\s+/).filter(Boolean);
    if (newPrefixes.length === 0) {
      return m.reply('❌ No valid prefixes provided.');
    }

    config.prefix = newPrefixes;
    return m.reply(`✅ *Bot prefix updated to:* \`[ ${config.prefix.join(' ')} ]\``);
  }
};
