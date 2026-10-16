/**
 * Plugin: Group Ephemeral (Disappearing Messages)
 * Access: Admin & Superadmin (Bot must be admin)
 */

module.exports = {
  command: ['ephemeral', 'pesansementara', 'disappearing'],
  tags: ['group'],
  help: ['ephemeral <off/24h/7d/90d>'],
  description: 'Set disappearing messages timer for the group',
  isGroup: true,
  isAdmin: true,
  isBotAdmin: true,

  run: async (m, { sock, args }) => {
    const option = (args[0] || '').toLowerCase();

    let duration = null;
    let label = '';

    if (option === 'off' || option === 'mati' || option === '0') {
      duration = 0;
      label = 'Off';
    } else if (option === '24h' || option === '1d' || option === '24jam') {
      duration = 86400;
      label = '24 Hours';
    } else if (option === '7d' || option === '7hari' || option === '1w') {
      duration = 604800;
      label = '7 Days';
    } else if (option === '90d' || option === '90hari' || option === '3m') {
      duration = 7776000;
      label = '90 Days';
    } else {
      return m.reply(
        '⚠️ *Invalid disappearing messages duration!*\n\n' +
        'Choose one of the following options:\n' +
        '• `.ephemeral off` — Turn off disappearing messages\n' +
        '• `.ephemeral 24h` — Messages disappear after 24 hours\n' +
        '• `.ephemeral 7d` — Messages disappear after 7 days\n' +
        '• `.ephemeral 90d` — Messages disappear after 90 days'
      );
    }

    try {
      await sock.sendMessage(m.chat, { disappearingMessagesInChat: duration });
      return m.reply(`⏳ *Disappearing Messages Updated!*\nNew duration: *${label}*`);
    } catch (err) {
      return m.reply(`❌ Failed to update disappearing messages: ${err.message}`);
    }
  }
};

