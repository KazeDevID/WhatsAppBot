/**
 * Plugin: Force Leave Group
 * Access: Owner Only
 */

module.exports = {
  command: ['leavebot', 'outgc', 'botleave'],
  tags: ['owners'],
  help: ['leavebot [group_jid]'],
  description: 'Force the bot to leave a specified group or the current group',
  isOwner: true,

  run: async (m, { sock, text }) => {
    let targetGroup = text ? text.trim() : (m.isGroup ? m.chat : null);

    if (!targetGroup || !targetGroup.endsWith('@g.us')) {
      return m.reply(
        `⚠️ *Specify a group JID or run this command inside a group!*\n\n` +
        `• Current Chat: ${m.chat}\n` +
        `• Example: \`.leavebot 120363000000000000@g.us\``
      );
    }

    try {
      await m.reply('👋 *Goodbye! Bot is leaving the group now...*');
      await sock.groupLeave(targetGroup);
      if (m.chat !== targetGroup) {
        await m.reply(`✅ *Bot successfully left group:* ${targetGroup}`);
      }
    } catch (err) {
      return m.reply(`❌ Failed to leave group: ${err.message}`);
    }
  }
};
