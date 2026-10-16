/**
 * Plugin: View Plugin Source Code
 * Access: Owner Only
 */
const fs = require('fs');
const path = require('path');

module.exports = {
  command: ['getplugin', 'sp', 'viewplugin'],
  tags: ['owners'],
  help: ['getplugin <plugin_name>'],
  description: 'View source code of any bot plugin file',
  isOwner: true,

  run: async (m, { text, plugins }) => {
    if (!text) {
      const pluginNames = Array.from(plugins.keys()).sort();
      return m.reply(
        `⚠️ *Please specify a plugin name!*\n\n` +
        `• Example: \`.getplugin menu\` or \`.getplugin owners/upsw.js\`\n\n` +
        `*Available Plugins (${pluginNames.length}):*\n` +
        pluginNames.map(p => `• ${p}`).slice(0, 30).join('\n') +
        (pluginNames.length > 30 ? `\n...and ${pluginNames.length - 30} more.` : '')
      );
    }

    const query = text.trim().toLowerCase();
    let foundFile = null;
    let relativeKey = null;

    for (const [key] of plugins) {
      if (key.toLowerCase() === query || key.toLowerCase() === `${query}.js`) {
        relativeKey = key;
        foundFile = path.join(__dirname, '..', key);
        break;
      }
    }

    if (!foundFile) {
      for (const [key, plugin] of plugins) {
        if (plugin.command) {
          const cmds = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
          if (cmds.some(c => typeof c === 'string' && c.toLowerCase() === query)) {
            relativeKey = key;
            foundFile = path.join(__dirname, '..', key);
            break;
          }
        }
      }
    }

    if (!foundFile || !fs.existsSync(foundFile)) {
      return m.reply(`❌ Plugin "${text}" was not found.`);
    }

    try {
      const content = fs.readFileSync(foundFile, 'utf8');
      return m.reply(
        `📄 *PLUGIN: ${relativeKey}*\n` +
        `─────────────────────\n` +
        `\`\`\`javascript\n${content}\n\`\`\``
      );
    } catch (err) {
      return m.reply(`❌ Error reading plugin file: ${err.message}`);
    }
  }
};
