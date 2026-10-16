/**
 * Plugin: Leave Group
 * Access: Superadmin (Group Creator) & Bot Owner Only
 */

module.exports = {
  command: ['leave', 'out', 'keluar'],
  tags: ['group'],
  help: ['leave'],
  description: 'Make the bot leave the group (Superadmin or Owner only)',
  isGroup: true,
  isSuperAdmin: true,

  run: async (m, { sock, config, groupMetadata }) => {
    const groupName = groupMetadata?.subject || 'this group';
    await m.reply(`👋 *Goodbye everyone!*\nThe bot is leaving *${groupName}* as requested by the Superadmin/Owner.`);
    
    setTimeout(async () => {
      try {
        await sock.groupLeave(m.chat);
      } catch (err) {
        console.error('Failed to leave group:', err);
      }
    }, 1500);
  }
};

