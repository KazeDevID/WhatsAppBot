/**
 * Plugin: Get Group Invite Link
 * Access: Group Member / Admin (Bot must be admin)
 */

module.exports = {
  command: ['linkgc', 'linkgroup', 'grouplink'],
  tags: ['group'],
  help: ['linkgc'],
  description: 'Get current WhatsApp group invite link',
  isGroup: true,
  isBotAdmin: true,

  run: async (m, { sock, groupMetadata }) => {
    try {
      const code = await sock.groupInviteCode(m.chat);
      const inviteUrl = `https://chat.whatsapp.com/${code}`;
      const groupName = groupMetadata?.subject || 'WhatsApp Group';

      return m.reply(
        `🔗 *GROUP INVITE LINK*\n\n` +
        `• Group: *${groupName}*\n` +
        `• Link: ${inviteUrl}\n\n` +
        `_Share the link above with anyone you want to invite._`
      );
    } catch (err) {
      return m.reply(`❌ Failed to retrieve group invite link: ${err.message}`);
    }
  }
};

