/**
 * Plugin: Delete Plugin File
 * Access: Owner Only
 */
const fs = require('fs');
const path = require('path');

module.exports = {
  command: ['delplugin', 'rmplugin', 'deleteplugin'],
  tags: ['owners'],
  help: ['delplugin <plugin_name>'],
  description: 'Delete a plugin file from the bot',
  isOwner: true,

  run: async (m, { text, plugins }) => {
    if (!text) {
      return m.reply(
        `⚠️ *Specify the plugin file to delete!*\n\n` +
        `• Example: \`.delplugin test.js\` or \`.delplugin group/sample.js\``
      );
    }

    const query = text.trim();
    let foundFile = null;
    let targetKey = null;

    for (const [key] of plugins) {
      if (key === query || key === `${query}.js` || path.basename(key) === query || path.basename(key, '.js') === query) {
        targetKey = key;
        foundFile = path.join(__dirname, '..', key);
        break;
      }
    }

    if (!foundFile || !fs.existsSync(foundFile)) {
      return m.reply(`❌ Plugin file "${text}" not found.`);
    }

    const protectedFiles = ['menu.js', 'owners/eval.js', 'owners/exec.js', 'owners/self.js'];
    if (protectedFiles.includes(targetKey)) {
      return m.reply(`🚫 Cannot delete essential core plugin "${targetKey}".`);
    }

    try {
      fs.unlinkSync(foundFile);
      plugins.delete(targetKey);
      return m.reply(`🗑️ *Plugin "${targetKey}" has been successfully deleted!*`);
    } catch (err) {
      return m.reply(`❌ Failed to delete plugin: ${err.message}`);
    }
  }
};
