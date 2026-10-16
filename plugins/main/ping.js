const os = require('os');

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}j ${m}m ${s}d`;
}

module.exports = {
  command: ['ping', 'p', 'speed'],
  tags: ['main'],
  help: ['ping'],
  description: 'Check bot response speed',
  run: async (m) => {
    const start = Date.now();
    const uptime = formatTime(process.uptime());
    const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

    const latency = Date.now() - start;

    await m.reply(`⚡ *PONG!*\n• Speed: *${latency} ms*\n• Runtime: *${uptime}*\n• RAM: *${mem} MB*`);
  }
};
