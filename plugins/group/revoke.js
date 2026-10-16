/**
 * Plugin: Revoke & Reset Group Invite Link
 * Access: Superadmin (Group Creator) & Owner (Bot must be admin)
 */

module.exports = {
  command: ['revoke', 'resetlink', 'tariklink'],
  tags: ['group'],
  help: ['revoke'],
  description: 'Revoke old group invite link and generate a new one (Superadmin only)',
  isGroup: true,
  isSuperAdmin: true,
  isBotAdmin: true,

  run: async (m, { sock, groupMetadata }) => {
    try {
      const newCode = await sock.groupRevokeInvite(m.chat);
      const newLink = `https://chat.whatsapp.com/${newCode}`;
      const groupName = groupMetadata?.subject || 'Group';

      return m.reply(
        `🔄 *INVITE LINK RESET!*\n\n` +
        `• Group: *${groupName}*\n` +
        `• The previous link has been revoked.\n` +
        `• New Link: ${newLink}`
      );
    } catch (err) {
      return m.reply(`❌ Failed to reset group invite link: ${err.message}`);
    }
  }
};

