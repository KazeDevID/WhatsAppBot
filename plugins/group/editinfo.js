/**
 * Plugin: Edit Group Info Permission (Locked / Unlocked)
 * Access: Admin & Superadmin (Bot must be admin)
 */

module.exports = {
  command: ['editinfo', 'editsetting', 'setinfo'],
  tags: ['group'],
  help: ['editinfo <open/close>'],
  description: 'Set group info editing permissions (all members or admins only)',
  isGroup: true,
  isAdmin: true,
  isBotAdmin: true,

  run: async (m, { sock, args }) => {
    const action = (args[0] || '').toLowerCase();

    if (action === 'open' || action === 'all' || action === 'buka') {
      await sock.groupSettingUpdate(m.chat, 'unlocked');
      return m.reply('🔓 *Group Info Editing Opened!*\nAll group members can now change the group subject, picture, and description.');
    } else if (action === 'close' || action === 'admin' || action === 'tutup') {
      await sock.groupSettingUpdate(m.chat, 'locked');
      return m.reply('🔒 *Group Info Editing Closed!*\nOnly group admins can now change the group info.');
    } else {
      return m.reply(
        '⚠️ *Invalid option!*\n\n' +
        'Use the following options:\n' +
        '• `.editinfo open` — All members can edit group info\n' +
        '• `.editinfo close` — Only admins can edit group info'
      );
    }
  }
};

