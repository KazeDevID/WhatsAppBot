/**
 * Plugin Loader & Command Dispatcher System
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');
const { getTarget, checkGroupPermissions } = require('./groups');
const { getBotIdentifiers } = require('./serialize');

const plugins = new Map();

/**
 * Recursively get all .js files in a directory
 * @param {string} dir
 * @returns {string[]}
 */
function getPluginFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getPluginFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Load all plugin files from plugins folder and any subfolders
 * @param {string} pluginDir 
 */
function loadPlugins(pluginDir = path.join(__dirname, '../plugins')) {
  const spinner = logger.createSpinner('Loading and registering plugins...');
  spinner.start();

  const resolvedDir = path.resolve(pluginDir);
  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
  }

  const files = getPluginFiles(resolvedDir);
  plugins.clear();

  for (const fullPath of files) {
    const relativePath = path.relative(resolvedDir, fullPath).replace(/\\/g, '/');
    try {
      delete require.cache[require.resolve(fullPath)];
      const plugin = require(fullPath);

      if (plugin && (plugin.command || plugin.run)) {
        plugin.filename = relativePath;
        plugins.set(relativePath, plugin);
      }
    } catch (err) {
      if (logger.error) logger.error(`Plugin ${relativePath}`, err);
    }
  }

  spinner.succeed(`Loading successfully ${plugins.size} plugins`);
}

const dirWatchers = new Map();

/**
 * Recursively watch directory and subdirectories for plugin changes
 * @param {string} dir Directory to watch
 * @param {string} resolvedRoot Root plugins directory
 */
function watchDirectory(dir, resolvedRoot) {
  if (dirWatchers.has(dir) || !fs.existsSync(dir)) return;

  try {
    const watcher = fs.watch(dir, (eventType, filename) => {
      if (!filename) return;
      const fullPath = path.join(dir, filename);
      const relativePath = path.relative(resolvedRoot, fullPath).replace(/\\/g, '/');

      if (fs.existsSync(fullPath)) {
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            watchDirectory(fullPath, resolvedRoot);
            return;
          }
        } catch (e) {}
      }

      if (!filename.endsWith('.js')) return;

      if (fs.existsSync(fullPath)) {
        try {
          delete require.cache[require.resolve(fullPath)];
          const plugin = require(fullPath);
          if (plugin && (plugin.command || plugin.run)) {
            plugin.filename = relativePath;
            plugins.set(relativePath, plugin);
            console.log(`[Plugin Reload] ${relativePath} updated.`);
          }
        } catch (err) {
          console.error(`[Plugin Error] Failed to reload ${relativePath}:`, err.message);
        }
      } else {
        plugins.delete(relativePath);
        console.log(`[Plugin Remove] ${relativePath} deleted.`);
      }
    });

    watcher.on('error', () => {
    });

    dirWatchers.set(dir, watcher);

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        watchDirectory(path.join(dir, entry.name), resolvedRoot);
      }
    }
  } catch (err) {
    console.error(`[Watch Error] Failed to watch ${dir}:`, err.message);
  }
}

/**
 * Enable auto hot-reload when plugin files are changed
 * @param {string} pluginDir 
 */
function watchPlugins(pluginDir) {
  const resolvedDir = path.resolve(pluginDir);
  if (!fs.existsSync(resolvedDir)) return;
  watchDirectory(resolvedDir, resolvedDir);
}

/**
 * Dispatcher to execute plugins from incoming messages
 * @param {import('baileys').WASocket} sock 
 * @param {object} m Serialized message
 * @param {object} config Bot configuration
 */
async function handleCommand(sock, m, config) {
  if (!m || !m.body) return;

  const botIds = getBotIdentifiers(sock);
  const ownerNumbers = new Set(
    (Array.isArray(config.owner) ? config.owner : [config.owner])
      .map(num => String(num).replace(/[^0-9]/g, ''))
      .filter(Boolean)
  );

  const cleanSender = m.sender ? m.sender.replace(/[^0-9]/g, '') : '';
  const senderJid = m.sender || '';
  const rawParticipant = m.key?.participant ? m.key.participant.replace(/[^0-9]/g, '') : '';
  const participantJid = m.key?.participant || '';
  const rawRemote = m.key?.remoteJid ? m.key.remoteJid.replace(/[^0-9]/g, '') : '';

  const isFromBot = Boolean(m.fromMe) ||
                    botIds.has(senderJid) ||
                    botIds.has(cleanSender) ||
                    botIds.has(participantJid) ||
                    botIds.has(rawParticipant) ||
                    [...botIds].some(bId => bId && (cleanSender.startsWith(bId) || rawParticipant.startsWith(bId)));

  const isFromOwner = isFromBot ||
                      ownerNumbers.has(cleanSender) ||
                      ownerNumbers.has(rawParticipant) ||
                      ownerNumbers.has(rawRemote) ||
                      [...ownerNumbers].some(oNum => oNum && (cleanSender.startsWith(oNum) || rawParticipant.startsWith(oNum)));

  const isOwner = isFromOwner || isFromBot;

  if (config.selfMode && !isFromBot && !isFromOwner) {
    return;
  }

  if (config.bannedChats && config.bannedChats.has(m.chat) && !isOwner) {
    return;
  }

  if (config.bannedUsers && (config.bannedUsers.has(cleanSender) || config.bannedUsers.has(m.sender)) && !isOwner) {
    return;
  }

  const prefixList = Array.isArray(config.prefix) ? config.prefix : [config.prefix];
  const usedPrefix = prefixList.find(p => m.body.startsWith(p)) || '';

  const bodyTrimmed = m.body.trim();
  const isCmd = Boolean(usedPrefix);
  const command = isCmd
    ? bodyTrimmed.slice(usedPrefix.length).trim().split(/\s+/)[0].toLowerCase()
    : bodyTrimmed.split(/\s+/)[0].toLowerCase();

  const args = isCmd
    ? bodyTrimmed.slice(usedPrefix.length + command.length).trim().split(/\s+/).filter(Boolean)
    : bodyTrimmed.slice(command.length).trim().split(/\s+/).filter(Boolean);
  const text = args.join(' ');

  let commandExecuted = false;

  for (const [, plugin] of plugins) {
    let match = false;

    if (plugin.command) {
      if (Array.isArray(plugin.command) && plugin.command.includes(command)) {
        match = true;
      } else if (typeof plugin.command === 'string' && plugin.command === command) {
        match = true;
      } else if (plugin.command instanceof RegExp && plugin.command.test(m.body)) {
        match = true;
      }
    }

    if (!match && typeof plugin.custom === 'function') {
      try {
        const customMatched = await plugin.custom(m, { sock, config, plugins });
        if (customMatched) return;
      } catch (err) {
        console.error(`[Plugin Custom Error]:`, err);
      }
    }

    if (match) {
      commandExecuted = true;
      const startTime = Date.now();

      if (plugin.isOwner && !isOwner) {
        if (logger.warn) logger.warn(`Access denied: The command "${command}" is for owner only.`);
        return m.reply(config.msg.ownerOnly);
      }

      if (plugin.isGroup && !m.isGroup) {
        return m.reply(config.msg.groupOnly);
      }

      if (plugin.isPrivate && m.isGroup) {
        return m.reply(config.msg.privateOnly);
      }

      let groupPerms = null;
      if (m.isGroup && (plugin.isAdmin || plugin.isSuperAdmin || plugin.isBotAdmin || plugin.tags?.includes('group') || plugin.filename?.startsWith('group/'))) {
        groupPerms = await checkGroupPermissions(sock, m);

        if (plugin.isSuperAdmin && !groupPerms.isSuperAdmin && !isOwner) {
          return m.reply(config.msg.superAdminOnly || '⚠️ This feature is exclusively for the Group Creator (Superadmin)!');
        }

        if (plugin.isAdmin && !groupPerms.isAdmin && !isOwner) {
          return m.reply(config.msg.adminOnly || '⚠️ This feature can only be used by Group Admins!');
        }

        if (plugin.isBotAdmin && !groupPerms.isBotAdmin) {
          return m.reply(config.msg.botAdmin || '⚠️ Please promote the bot to Group Admin first!');
        }
      }

      try {
        await plugin.run(m, {
          sock,
          args,
          text,
          prefix: usedPrefix,
          command,
          config,
          plugins,
          isOwner,
          groupMetadata: groupPerms?.groupMetadata || null,
          participants: groupPerms?.participants || [],
          groupAdmins: groupPerms?.groupAdmins || [],
          isAdmin: Boolean(groupPerms?.isAdmin),
          isSuperAdmin: Boolean(groupPerms?.isSuperAdmin),
          isBotAdmin: Boolean(groupPerms?.isBotAdmin),
          getTarget: (customArgs, customText) => getTarget(m, customArgs || args, customText !== undefined ? customText : text)
        });
        const latency = Date.now() - startTime;
        if (logger.command) {
          logger.command({
            command: `${usedPrefix || ''}${command}`,
            sender: cleanSender,
            pushName: m.pushName,
            latency
          });
        } else {
          console.log(`[COMMAND] "${command}" processed (${latency}ms)`);
        }
      } catch (err) {
        if (logger.error) {
          logger.error(`Plugin ${plugin.filename}`, err);
        } else {
          console.error(`[Plugin Exec Error ${plugin.filename}]:`, err);
        }
        m.reply(`${config.msg.error}\nDetail: ${err.message}`);
      }
      return;
    }
  }

  if (isCmd && !commandExecuted) {
  }
}

module.exports = {
  plugins,
  loadPlugins,
  watchPlugins,
  handleCommand
};
