/**
 * Plugin: Restart Bot Process
 * Access: Owner Only
 */

module.exports = {
  command: ['restart', 'reboot'],
  tags: ['owners'],
  help: ['restart'],
  description: 'Safely restart the bot process',
  isOwner: true,

  run: async (m) => {
    await m.reply('🔄 *Restarting bot process... Please wait a few seconds.*');
    setTimeout(() => {
      process.exit(0);
    }, 1500);
  }
};
