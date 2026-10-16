const { exec } = require('child_process');

function checkOwner(m, sock, config) {
  const cleanSender = m.sender ? m.sender.replace(/[^0-9]/g, '') : '';
  const botNumber = sock.user?.id ? sock.user.id.replace(/[^0-9]/g, '').split(':')[0] : '';
  const ownerList = (Array.isArray(config.owner) ? config.owner : [config.owner])
    .map(num => String(num).replace(/[^0-9]/g, ''))
    .filter(Boolean);

  return ownerList.some(num => cleanSender.includes(num)) ||
         Boolean(m.fromMe) ||
         (botNumber && cleanSender.startsWith(botNumber));
}

function runExec(cmd, m) {
  exec(cmd, { timeout: 60000, maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
    if (error) {
      return m.reply(stderr || error.message || String(error));
    }
    if (stderr) {
      return m.reply(stderr);
    }
    m.reply(stdout || 'Command executed with no output.');
  });
}

module.exports = {
  command: ['exec', '$'],
  tags: ['owners'],
  help: ['exec'],
  description: 'Running terminal/bash commands (Owner only)',
  isOwner: true,

  run: async (m, context) => {
    let commandStr = context.text;
    if (!commandStr && context.command === '$') {
      commandStr = context.args.join(' ');
    }
    if (!commandStr) {
      return m.reply('Enter the terminal command you want to run!\nExample: `.exec ls -la` or `$ ls`');
    }
    runExec(commandStr, m);
  },

  custom: async (m, context) => {
    if (!m.body) return false;
    const trimmed = m.body.trim();
    if (trimmed.startsWith('$')) {
      if (!checkOwner(m, context.sock, context.config)) return false;
      const cmdStr = trimmed.slice(1).trim();
      if (cmdStr) {
        runExec(cmdStr, m);
        return true;
      }
    }
    return false;
  }
};
