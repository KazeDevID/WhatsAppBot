/**
 * Plugin: Group Chat Setting (Open / Close Group)
 * Access: Admin & Superadmin (Bot must be admin)
 */

module.exports = {
  command: ['group', 'gc', 'grup'],
  tags: ['group'],
  help: ['group <open/close>'],
  description: 'Open or close group chat (admins only or all members)',
  isGroup: true,
  isAdmin: true,
  isBotAdmin: true,

  run: async (m, { sock, args }) => {
    const action = (args[0] || '').toLowerCase();

    if (action === 'open' || action === 'buka') {
      await sock.groupSettingUpdate(m.chat, 'not_announcement');
      return m.reply('🔓 *Group Opened!*\nAll group members can now send messages.');
    } else if (action === 'close' || action === 'tutup') {
      await sock.groupSettingUpdate(m.chat, 'announcement');
      return m.reply('🔒 *Group Closed!*\nOnly group admins can now send messages.');
    } else {
      return m.reply(
        '⚠️ *Invalid command!*\n\n' +
        'Use one of the following options:\n' +
        '• `.group open` — Allow all members to send messages\n' +
        '• `.group close` — Restrict messaging to admins only'
      );
    }
  }
};

