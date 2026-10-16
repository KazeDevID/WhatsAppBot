module.exports = {
  command: ['self'],
  tags: ['owners'],
  help: ['self'],
  description: 'Change bot mode to Self (owner only)',
  isOwner: true,

  run: async (m, { config }) => {
    if (config.selfMode) {
      return m.reply('The bot is already in *Self* mode.');
    }
    config.selfMode = true;
    m.reply('Successfully changed to *Self* mode.\nNow only Owner can use the bot.'); 
  }
};
