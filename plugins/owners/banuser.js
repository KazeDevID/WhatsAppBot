/**
 * Plugin: Ban / Unban User
 * Access: Owner Only
 * Commands: banuser, unbanuser, ban, unban
 */

module.exports = {
  command: ['banuser', 'unbanuser', 'ban', 'unban'],
  tags: ['owners'],
  help: ['banuser <tag/reply/number>', 'unbanuser <tag/reply/number>'],
  description: 'Ban or unban a user from using any bot commands',
  isOwner: true,

  run: async (m, { command, config, getTarget }) => {
    config.bannedUsers = config.bannedUsers || new Set();

    const target = getTarget();
    if (!target || !target.jid) {
      return m.reply(
        `⚠️ *Specify the user to ban or unban!*\n\n` +
        `• Tag user: \`.${command} @user\`\n` +
        `• Reply to user message: \`.${command}\`\n` +
        `• Phone number: \`.${command} 628123456789\`\n` +
        `• Or run directly in the user's private chat.`
      );
    }

    const cleanNum = target.number;
    const targetJid = target.jid;
    const isUnban = command === 'unbanuser' || command === 'unban';

    if (isUnban) {
      config.bannedUsers.delete(cleanNum);
      config.bannedUsers.delete(targetJid);
      return m.reply(`✅ *User successfully unbanned!*\n\n• User: @${cleanNum}\n• Allowed to use bot commands again.`, m, {
        mentions: [targetJid]
      });
    } else {
      const owners = Array.isArray(config.owner) ? config.owner : [config.owner];
      if (owners.some(o => String(o).replace(/[^0-9]/g, '') === cleanNum)) {
        return m.reply('❌ You cannot ban a bot owner!');
      }

      config.bannedUsers.add(cleanNum);
      config.bannedUsers.add(targetJid);
      return m.reply(`🚫 *User successfully banned!*\n\n• User: @${cleanNum}\n• Blocked from using all bot commands.`, m, {
        mentions: [targetJid]
      });
    }
  }
};
