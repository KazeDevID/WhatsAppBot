module.exports = {
  command: ['public'],
  tags: ['owners'],
  help: ['public'],
  description: 'Change the bot mode to Public (everyone)',
  isOwner: true,

  run: async (m, { config }) => {
    if (!config.selfMode) {
      return m.reply('The bot is already in *Public* mode.');
    }
    config.selfMode = false;
    m.reply('Successfully changed to *Public* mode.\nNow all users can use the bot.');
  }
};
