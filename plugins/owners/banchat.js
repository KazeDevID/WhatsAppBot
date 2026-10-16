/**
 * Plugin: Ban / Mute Chat
 * Access: Owner Only
 * Commands: banchat, unbanchat, mutechat, unmutechat
 */

module.exports = {
  command: ['banchat', 'unbanchat', 'mutechat', 'unmutechat'],
  tags: ['owners'],
  help: ['banchat [chat_jid]', 'unbanchat [chat_jid]'],
  description: 'Ban or unban bot from responding in a specific group or chat',
  isOwner: true,

  run: async (m, { text, command, config }) => {
    config.bannedChats = config.bannedChats || new Set();

    const targetChat = text ? text.trim() : m.chat;
    const isUnban = command === 'unbanchat' || command === 'unmutechat';

    if (isUnban) {
      if (!config.bannedChats.has(targetChat)) {
        return m.reply(`ℹ️ Chat *${targetChat}* is not currently banned.`);
      }
      config.bannedChats.delete(targetChat);
      return m.reply(`✅ *Chat successfully unbanned!*\n\n• *Target:* ${targetChat}\n• Bot will now respond to regular commands here.`);
    } else {
      config.bannedChats.add(targetChat);
      return m.reply(`🚫 *Chat successfully banned / muted!*\n\n• *Target:* ${targetChat}\n• Bot will ignore non-owner commands in this chat.`);
    }
  }
};
