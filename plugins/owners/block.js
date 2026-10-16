/**
 * Plugin: Block User
 * Access: Owner Only
 */

module.exports = {
  command: ['block', 'blokir'],
  tags: ['owners'],
  help: ['block <tag/reply/number>'],
  description: 'Block a user on WhatsApp',
  isOwner: true,

  run: async (m, { sock, getTarget, config }) => {
    const target = getTarget();

    if (!target || !target.jid) {
      return m.reply(
        `⚠️ *Specify target user to block!*\n\n` +
        `• Tag user: \`.block @user\`\n` +
        `• Reply user message: \`.block\`\n` +
        `• Phone number: \`.block 628123456789\`\n` +
        `• Or type \`.block\` directly in the target's private chat.`
      );
    }

    const cleanNum = target.number;
    const targetJid = target.jid;

    const owners = Array.isArray(config.owner) ? config.owner : [config.owner];
    if (owners.some(o => String(o).replace(/[^0-9]/g, '') === cleanNum)) {
      return m.reply('❌ You cannot block a bot owner!');
    }

    const botJid = sock.decodeJid ? sock.decodeJid(sock.user?.id || '') : (sock.user?.id || '');
    const cleanBot = botJid.replace(/[^0-9]/g, '').split('@')[0];
    if (cleanNum === cleanBot) {
      return m.reply('❌ The bot cannot block itself!');
    }

    try {
      await sock.updateBlockStatus(targetJid, 'block');
      return m.reply(`🚫 *Successfully blocked user:* @${cleanNum}`, m, {
        mentions: [targetJid]
      });
    } catch (err) {
      return m.reply(`❌ Failed to block user: ${err.message}`);
    }
  }
};
