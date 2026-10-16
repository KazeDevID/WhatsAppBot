/**
 * Plugin: Unblock User
 * Access: Owner Only
 */

module.exports = {
  command: ['unblock', 'unblokir'],
  tags: ['owners'],
  help: ['unblock <tag/reply/number>'],
  description: 'Unblock a user on WhatsApp',
  isOwner: true,

  run: async (m, { sock, getTarget }) => {
    const target = getTarget();

    if (!target || !target.jid) {
      return m.reply(
        `⚠️ *Specify target user to unblock!*\n\n` +
        `• Tag user: \`.unblock @user\`\n` +
        `• Reply user message: \`.unblock\`\n` +
        `• Phone number: \`.unblock 628123456789\`\n` +
        `• Or type \`.unblock\` directly in the target's private chat.`
      );
    }

    const cleanNum = target.number;
    const targetJid = target.jid;

    try {
      await sock.updateBlockStatus(targetJid, 'unblock');
      return m.reply(`✅ *Successfully unblocked user:* @${cleanNum}`, m, {
        mentions: [targetJid]
      });
    } catch (err) {
      return m.reply(`❌ Failed to unblock user: ${err.message}`);
    }
  }
};
