const path = require('path');

module.exports = {
  command: ['menu', 'help'],
  tags: ['main'],
  help: ['menu'],
  description: 'Displays interactive list menu with auto-detected categories',
  run: async (m, { sock, config, prefix, plugins, isOwner, isAdmin, isSuperAdmin }) => {
    const p = prefix || '.';
    const botName = (config.botName || 'ZETTAI BOT').toUpperCase();

    const categoryPresets = {
      main: { title: '🌟 MAIN MENU', highlight: 'Populer', defaultHeader: '✨ Fitur Utama' },
      group: { title: '👥 GROUP MENU', highlight: 'Admin & Superadmin', defaultHeader: '👥 Kelola Grup' },
      owners: { title: '👑 OWNER MENU', highlight: 'Khusus Owner', defaultHeader: '👑 Owner Only' }
    };

    const detectedCategories = new Map();
    const visitedCmds = new Set();
    let totalCommands = 0;

    const registeredPlugins = plugins || new Map();

    for (const [filename, plugin] of registeredPlugins) {
      if (!plugin || !plugin.command) continue;
      const rawCmd = Array.isArray(plugin.command) ? plugin.command[0] : plugin.command;
      if (!rawCmd || typeof rawCmd !== 'string') continue;
      if (visitedCmds.has(rawCmd)) continue;
      visitedCmds.add(rawCmd);
      totalCommands++;

      let tag = 'main';
      if (plugin.tags && Array.isArray(plugin.tags) && plugin.tags.length > 0 && plugin.tags[0]) {
        tag = String(plugin.tags[0]).toLowerCase();
      } else if (filename && typeof filename === 'string' && filename.includes('/')) {
        tag = filename.split('/')[0].toLowerCase();
      } else if (plugin.isOwner) {
        tag = 'owners';
      } else if (plugin.isAdmin || plugin.isSuperAdmin) {
        tag = 'group';
      }

      if (!detectedCategories.has(tag)) {
        const preset = categoryPresets[tag] || {
          title: `📁 MENU ${tag.toUpperCase()}`,
          highlight: tag.length <= 15 ? tag.toUpperCase() : 'Feature',
          defaultHeader: `📌 ${tag}`
        };

        detectedCategories.set(tag, {
          title: preset.title,
          highlight: preset.highlight,
          defaultHeader: preset.defaultHeader,
          commands: [],
          rows: []
        });
      }

      const cat = detectedCategories.get(tag);

      let rowHeader = cat.defaultHeader;
      let badgeText = '';
      if (plugin.isSuperAdmin) {
        rowHeader = '👑 Superadmin';
        badgeText = '[Superadmin] ';
      } else if (plugin.isAdmin) {
        rowHeader = '🛡️ Admin';
        badgeText = '[Admin] ';
      } else if (plugin.isOwner) {
        rowHeader = '👑 Owner';
        badgeText = '[Owner] ';
      }

      const rawDesc = plugin.description || `Order ${rawCmd}`;
      const cleanDesc = (badgeText + rawDesc).slice(0, 70);

      cat.commands.push({
        cmd: rawCmd,
        help: plugin.help ? plugin.help[0] : rawCmd,
        desc: rawDesc,
        badge: badgeText.trim() ? ` \`${badgeText.trim()}\`` : ''
      });

      cat.rows.push({
        header: rowHeader,
        title: `${p}${rawCmd}`.slice(0, 24),
        description: cleanDesc,
        id: `${p}${rawCmd}`
      });
    }

    const priorityOrder = ['main', 'group', 'owners'];
    const sortedTags = Array.from(detectedCategories.keys()).sort((a, b) => {
      const idxA = priorityOrder.indexOf(a);
      const idxB = priorityOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    const listSections = [];
    for (const tag of sortedTags) {
      const cat = detectedCategories.get(tag);
      if (cat.rows.length > 0) {
        listSections.push({
          title: cat.title,
          highlight_label: cat.highlight,
          rows: cat.rows
        });
      }
    }

    let userRole = '👤 Pengguna';
    if (isOwner) {
      userRole = '👑 Owner Bot';
    } else if (isSuperAdmin) {
      userRole = '👑 Superadmin Grup';
    } else if (isAdmin) {
      userRole = '🛡️ Admin Grup';
    }

    const timeStr = new Date().toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'full'
    });

    let bodyText = `• Mode: *${config.selfMode ? 'Self Mode' : 'Public Mode'}*\n`;
    bodyText += `• Prefix: *[ ${p} ]*\n`;
    bodyText += `• Your Status: *${userRole}*\n`;
    bodyText += `• Total Features: *${totalCommands} Commands* (${listSections.length} Categories)\n`;
    bodyText += `• Time: ${timeStr}\n\n`;
    bodyText += `_Press the *Menu List* button below to instantly select and execute a command from the interactive list._`;

    let fullTextMenu = `• Mode: *${config.selfMode ? 'Self Mode' : 'Public Mode'}*\n`;
    fullTextMenu += `• Prefix: *[ ${p} ]*\n`;
    fullTextMenu += `• Status: *Active*\n`;
    fullTextMenu += `• Total Features: *${totalCommands} Commands*\n\n`;

    for (const tag of sortedTags) {
      const cat = detectedCategories.get(tag);
      if (cat.commands.length === 0) continue;
      fullTextMenu += `╭───「 *${cat.title}* 」\n`;
      for (const cmd of cat.commands) {
        fullTextMenu += `│ • *${p}${cmd.help}*${cmd.badge}\n`;
        if (cmd.desc) fullTextMenu += `│   _${cmd.desc}_\n`;
      }
      fullTextMenu += `╰─────────────────\n\n`;
    }
    fullTextMenu += `_Type the command with the prefix [ ${p} ]_`;

    try {
      await sock.sendInteractive(m.chat, {
        title: `🤖 ${botName}`,
        subtitle: 'Interactive Menu System',
        body: bodyText,
        footer: `© ${new Date().getFullYear()} ${config.botName || 'Zettai'} • Native Flow List`,
        listTitle: 'Menu List',
        listSections: listSections,
        buttons: [
          {
            name: 'single_select',
            title: 'Menu List',
            sections: listSections
          },
          {
            type: 'quick_reply',
            display_text: 'Ping Server',
            id: `${p}ping`
          }
        ]
      }, m);
    } catch (err) {
      console.error('[Menu Error] Failed to send interactive menu:', err?.message || err);
      await m.reply(fullTextMenu);
    }
  }
};

