const util = require('util');

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

async function executeEval(code, m, context) {
  const { sock, config, plugins } = context;
  try {
    const trimmedCode = code.trim();
    const isAsync = /await\s+/.test(trimmedCode) || /^return\s+/.test(trimmedCode);
    const codeToEval = isAsync ? `(async () => {\n${trimmedCode}\n})()` : trimmedCode;

    const evalFunction = new Function(
      'sock',
      'm',
      'config',
      'plugins',
      'process',
      'require',
      `return (async () => {\nreturn ${codeToEval};\n})();`
    );

    let result = await evalFunction(sock, m, config, plugins, process, require);

    if (typeof result !== 'string') {
      result = util.inspect(result, { depth: 2 });
    }
    await m.reply(result);
  } catch (err) {
    await m.reply(err ? err.stack || err.message || String(err) : 'Unknown Error');
  }
}

module.exports = {
  command: ['eval', '>', '>>'],
  tags: ['owners'],
  help: ['eval'],
  description: 'Evaluating JavaScript code (Owner Only)',
  isOwner: true,

  run: async (m, context) => {
    let code = context.text;
    if (!code && (context.command === '>' || context.command === '>>')) {
      code = context.args.join(' ');
    }
    if (!code) {
      return m.reply('Enter the JavaScript code you want to evaluate!\nExample: `.eval 1 + 1`');
    }
    await executeEval(code, m, context);
  },

  custom: async (m, context) => {
    if (!m.body) return false;
    const trimmed = m.body.trim();
    if (trimmed.startsWith('>>')) {
      if (!checkOwner(m, context.sock, context.config)) return false;
      const code = trimmed.slice(2).trim();
      if (code) {
        await executeEval(code, m, context);
        return true;
      }
    } else if (trimmed.startsWith('>')) {
      if (!checkOwner(m, context.sock, context.config)) return false;
      const code = trimmed.slice(1).trim();
      if (code) {
        await executeEval(code, m, context);
        return true;
      }
    }
    return false;
  }
};
