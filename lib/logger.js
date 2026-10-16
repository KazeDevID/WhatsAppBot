/**
 * Terminal Logger & Star Spinner Module
 */

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  gray: '\x1b[90m'
};

const c = {
  emerald: (t) => `${colors.brightGreen}${t}${colors.reset}`,
  cyan: (t) => `${colors.brightCyan}${t}${colors.reset}`,
  yellow: (t) => `${colors.brightYellow}${t}${colors.reset}`,
  blue: (t) => `${colors.brightBlue}${t}${colors.reset}`,
  magenta: (t) => `${colors.brightMagenta}${t}${colors.reset}`,
  red: (t) => `${colors.red}${t}${colors.reset}`,
  gray: (t) => `${colors.gray}${t}${colors.reset}`,
  bold: (t) => `${colors.bold}${t}${colors.reset}`,
  white: (t) => `${colors.brightWhite}${t}${colors.reset}`
};

const STAR_FRAMES = [
  '✦ ✧ ✶',
  '✧ ✦ ✷',
  '✶ ✧ ✸',
  '✷ ✶ ✹',
  '✸ ✷ ✺',
  '✹ ✸ ✻',
  '✻ ✹ ✼',
  '✼ ✻ ✽'
];

class StarSpinner {
  constructor(text = 'Load...') {
    this.text = text;
    this.frameIndex = 0;
    this.interval = null;
    this.isSpinning = false;
  }

  start(newText) {
    if (newText) this.text = newText;
    if (this.isSpinning) return this;
    this.isSpinning = true;

    if (process.stdout.isTTY) {
      process.stdout.write('\x1b[?25l');
    }

    this.interval = setInterval(() => {
      const star = STAR_FRAMES[this.frameIndex % STAR_FRAMES.length];
      const time = new Date().toLocaleTimeString([], { hour12: false });
      const line = `\r ${star} ${c.gray(`[${time}]`)} ${c.white(this.text)}`;
      process.stdout.write(line);
      this.frameIndex++;
    }, 120);

    return this;
  }

  update(text) {
    this.text = text;
    return this;
  }

  succeed(text) {
    this._stop();
    const time = new Date().toLocaleTimeString([], { hour12: false });
    const successMsg = text || this.text;
    console.log(`\r ${c.emerald('[SUCCESS]')} ${c.gray(`[${time}]`)} ${c.bold(successMsg)}`);
    return this;
  }

  fail(text) {
    this._stop();
    const time = new Date().toLocaleTimeString([], { hour12: false });
    const errorMsg = text || this.text;
    console.log(`\r ✖ ${c.red('[FAIL]')} ${c.gray(`[${time}]`)} ${c.bold(errorMsg)}`);
    return this;
  }

  warn(text) {
    this._stop();
    const time = new Date().toLocaleTimeString([], { hour12: false });
    console.log(`\r ⚠️ ${c.yellow('[WARNING]')} ${c.gray(`[${time}]`)} ${text || this.text}`);
    return this;
  }

  _stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isSpinning = false;
    if (process.stdout.isTTY) {
      process.stdout.write('\r\x1b[K\x1b[?25h');
    } else {
      process.stdout.write('\r');
    }
  }
}

const logHistory = [];
function recordLog(level, tag, text) {
  const time = new Date().toLocaleTimeString([], { hour12: false });
  logHistory.push({ time, level, tag, text });
  if (logHistory.length > 250) logHistory.shift();
}

function getLogHistory() {
  return [...logHistory];
}

const logger = {
  createSpinner: (text) => new StarSpinner(text),

  banner: ({ botName = 'Zettai BOT+', version = 'v1.0.0', mode = 'Public', pluginCount = 7 }) => {
    const border = '═'.repeat(60);
    console.log('\n' + c.cyan(`╔${border}╗`));
    console.log(c.cyan('║') + c.bold(c.white(`        B A I L E Y S   v ${version}   B O T         `)).padStart(54) + c.cyan('║'));
    console.log(c.cyan(`╠${border}╣`));
    console.log(c.cyan('║') + `     Bot Name     : ${c.emerald(botName.padEnd(40))}` + c.cyan('║'));
    console.log(c.cyan('║') + `     Access Mode  : ${c.yellow(mode.padEnd(40))}` + c.cyan('║'));
    console.log(c.cyan('║') + `     Total Plugin : ${c.cyan(`${pluginCount} registered plugins`.padEnd(40))}` + c.cyan('║'));
    console.log(c.cyan(`╚${border}╝\n`));
    recordLog('info', 'BANNER', `${botName} (Baileys v${version}) started in ${mode} mode with ${pluginCount} plugins`);
  },

  pairing: (code) => {
    console.log('\n' + c.yellow('┌──────────────────────────────────────────────────────────┐'));
    console.log(c.yellow('│') + c.bold('     WHATSAPP PAIRING CODE (BAILEYS v7)                   ') + c.yellow('│'));
    console.log(c.yellow('│') + `             ${c.bold(c.white(code))}                                         `.slice(0, 58) + c.yellow('│'));
    console.log(c.yellow('│') + c.gray('  Go to: WhatsApp > Linked Devices > Link via Number  ') + c.yellow('│'));
    console.log(c.yellow('└──────────────────────────────────────────────────────────┘\n'));
    recordLog('pairing', 'PAIRING CODE', code);
  },

  message: ({ sender = 'Unknown', pushName = 'User', chatType = 'Private', body = '', fromMe = false }) => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    const cleanNum = sender.replace(/[^0-9]/g, '');
    const selfTag = fromMe ? c.cyan(' (Your Device)') : '';
    console.log(`\n${c.gray(`[${time}]`)} ${c.bold(c.white('[INCOMING MESSAGES]'))} [${c.cyan(chatType)}${selfTag}] From: ${c.emerald(pushName)} ${c.gray(`(+${cleanNum})`)}`);
    if (body) {
      console.log(`   ${c.white(`"${body}"`)}`);
    }
    recordLog('message', `MSG (${chatType})`, `${pushName} (+${cleanNum}): ${body}`);
  },

  command: ({ command, sender = '', pushName = '', latency = 0 }) => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    const cleanNum = sender.replace(/[^0-9]/g, '');
    console.log(`${c.gray(`[${time}]`)} ${c.bold(c.emerald(' [COMMAND]'))} ${c.yellow(command)} run by ${c.white(pushName || 'User')} ${c.gray(`(+${cleanNum})`)} ${c.cyan(`(${latency}ms)`)}`);
    recordLog('command', 'COMMAND', `${command} by ${pushName || 'User'} (+${cleanNum}) (${latency}ms)`);
  },

  interactive: ({ jid, type = 'buttons', count = 1, types = [] }) => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    const typesStr = types.length ? ` (${types.join(', ')})` : '';
    console.log(`${c.gray(`[${time}]`)} ${c.bold(c.magenta('[NATIVE FLOW]'))} Send ${count} button${typesStr} to ${c.gray(jid)}`);
    recordLog('interactive', 'NATIVE FLOW', `Sent ${count} button${typesStr} to ${jid}`);
  },

  info: (text) => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    console.log(`${c.gray(`[${time}]`)} ${c.blue('[INFO]')} ${text}`);
    recordLog('info', 'INFO', text);
  },

  warn: (text) => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    console.log(`${c.gray(`[${time}]`)} ${c.yellow('[WARNING]')} ${text}`);
    recordLog('warn', 'WARNING', text);
  },

  error: (tag, err) => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    const errMsg = err?.message || err;
    console.error(`${c.red('✖')} ${c.gray(`[${time}]`)} ${c.bold(c.red(`[ERROR - ${tag}]`))} ${errMsg}`);
    recordLog('error', tag, errMsg);
  },

  getLogHistory
};

module.exports = {
  logger,
  StarSpinner,
  c,
  getLogHistory
};
