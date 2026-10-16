/**
 * Plugin: Gist-Based Bot Updater
 * Access: Bot Owner Only
 * Description: Fetches and applies updates / new files from a GitHub Gist URL
 * Example: .update https:
 * Supports saving anywhere:
 *  - Home / Root:
 *  - Lib folder:
 *  - Plugins folder:
 *  - Any custom directory:
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const HEADER_REGEX = /(?:^|\n)(?:\/\/|\/\*|#)\s*(?:\(([^)\r\n]+)\)|\[([^\]\r\n]+)\]|(?:file|path)\s*:\s*([^\r\n]+))\s*(?:\*\/)?/gi;

/**
 * Extracts Gist ID from various GitHub Gist URL formats
 * @param {string} input
 * @returns {string|null}
 */
function extractGistId(input) {
  if (!input) return null;
  const trimmed = input.trim();

  if (/^[a-f0-9]{20,40}$/i.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/gist\.github(?:usercontent)?\.com\/[^\/]+\/([a-f0-9]{20,40})/i);
  if (match) return match[1];

  const segments = trimmed.split(/[\/?#]/).filter(Boolean);
  const lastHex = segments.find(s => /^[a-f0-9]{20,40}$/i.test(s));
  return lastHex || null;
}

/**
 * Safely resolves target path against root directory (allowing home, lib, plugins, etc.)
 * @param {string} rawTargetPath 
 * @param {string} rootDir 
 * @returns {{ absPath: string, relPath: string } | null}
 */
function resolveDestination(rawTargetPath, rootDir = process.cwd()) {
  if (!rawTargetPath) return null;
  let clean = rawTargetPath.trim();

  clean = clean.replace(/^["'`]+|["'`]+$/g, '').trim();

  clean = clean.replace(/^[\\\/]+/, '').replace(/^(\.[\\\/])+/, '');

  clean = path.normalize(clean);

  clean = clean.replace(/^(\.\.[\\\/])+/g, '').replace(/[\\\/]\.\.[\\\/]/g, '/');

  if (!clean || clean === '.' || clean === '/') {
    return null;
  }

  const absPath = path.resolve(rootDir, clean);
  if (!absPath.startsWith(rootDir)) {
    return null;
  }

  const relPath = path.relative(rootDir, absPath).replace(/\\/g, '/');
  return { absPath, relPath };
}

/**
 * Parses files from Gist payload, supporting single-file and multi-file blocks anywhere
 * @param {object} filesObj Gist files from GitHub API
 * @returns {Array<{ targetPath: string, content: string, sourceName: string }>}
 */
function parseGistFiles(filesObj) {
  const results = [];

  for (const [sourceName, fileData] of Object.entries(filesObj)) {
    const rawContent = fileData.content || '';
    if (!rawContent.trim()) continue;

    HEADER_REGEX.lastIndex = 0;
    const matches = [...rawContent.matchAll(HEADER_REGEX)];

    if (matches.length > 1) {
      for (let i = 0; i < matches.length; i++) {
        const currentMatch = matches[i];
        const rawTarget = (currentMatch[1] || currentMatch[2] || currentMatch[3] || '').trim();
        const startIndex = currentMatch.index;
        const endIndex = (i + 1 < matches.length) ? matches[i + 1].index : rawContent.length;
        const fileContent = rawContent.slice(startIndex, endIndex).trim();

        results.push({
          targetPath: rawTarget || sourceName,
          content: fileContent,
          sourceName
        });
      }
    } else if (matches.length === 1) {
      const rawTarget = (matches[0][1] || matches[0][2] || matches[0][3] || '').trim();
      results.push({
        targetPath: rawTarget || sourceName,
        content: rawContent,
        sourceName
      });
    } else {
      results.push({
        targetPath: sourceName,
        content: rawContent,
        sourceName
      });
    }
  }

  return results;
}

module.exports = {
  command: ['update', 'up', 'gist'],
  tags: ['owners'],
  help: ['update <url_gist>'],
  description: 'Update atau tambah file bot dari URL Gist GitHub (bebas lokasi)',
  isOwner: true,

  run: async (m, { args, text, plugins }) => {
    const gistUrl = (args[0] || text || '').trim();

    if (!gistUrl) {
      return m.reply(
        '⚠️ *URL Gist GitHub Diperlukan!*\n\n' +
        '• Penggunaan: `.update <url_gist>`\n' +
        '• Contoh: `.update https://gist.github.com/KazeDevID/29bb8718ed6d2e87c99b88c33d9bf37c`\n\n' +
        '📍 *Penulisan Jalur Berkas (Bebas di Mana Saja):*\n' +
        '• *Home / Root (Folder Utama):* `// (/hehe.js)` atau `// (hehe.js)`\n' +
        '• *Folder Lib:* `// (lib/hehe.js)` atau `// (/lib/hehe.js)`\n' +
        '• *Folder Plugins:* `// (plugins/agh.js)`\n' +
        '• *Folder Kustom Lainnya:* `// (nama_folder/file.js)`\n\n' +
        '_Cukup tuliskan tanda komentar tersebut di awal file pada Gist._'
      );
    }

    const gistId = extractGistId(gistUrl);
    if (!gistId) {
      return m.reply('❌ URL atau ID Gist tidak valid! Harap masukkan tautan Gist GitHub yang benar.');
    }

    await m.reply('⏳ Mengunduh dan menganalisis konten Gist dari GitHub...');

    try {
      const response = await axios.get(`https://api.github.com/gists/${gistId}`, {
        headers: {
          'User-Agent': 'Zettai-WhatsApp-Bot',
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 15000
      });

      const gistData = response.data;
      if (!gistData.files || Object.keys(gistData.files).length === 0) {
        return m.reply('❌ Gist tidak berisi file apapun.');
      }

      for (const [name, fileObj] of Object.entries(gistData.files)) {
        if (fileObj.truncated && fileObj.raw_url) {
          try {
            const rawRes = await axios.get(fileObj.raw_url, { timeout: 15000 });
            fileObj.content = typeof rawRes.data === 'string' ? rawRes.data : JSON.stringify(rawRes.data, null, 2);
          } catch (e) {
            console.error(`Failed to fetch raw file ${name}:`, e.message);
          }
        }
      }

      const filesToProcess = parseGistFiles(gistData.files);

      if (filesToProcess.length === 0) {
        return m.reply('❌ Tidak ada file valid yang dapat diproses dari Gist.');
      }

      const rootDir = process.cwd();
      const summaryList = [];

      for (const item of filesToProcess) {
        const dest = resolveDestination(item.targetPath, rootDir);

        if (!dest) {
          summaryList.push(`❌ \`${item.targetPath}\` — Ditolak (Path traversal atau tidak valid)`);
          continue;
        }

        const { absPath: destinationPath, relPath: relativeTarget } = dest;

        const isExisting = fs.existsSync(destinationPath);
        const parentDir = path.dirname(destinationPath);

        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }

        fs.writeFileSync(destinationPath, item.content, 'utf8');

        let locationDesc = '';
        if (relativeTarget.startsWith('plugins/')) {
          locationDesc = '[Plugins]';
        } else if (relativeTarget.startsWith('lib/')) {
          locationDesc = '[Lib]';
        } else if (!relativeTarget.includes('/')) {
          locationDesc = '[Home/Root]';
        } else {
          locationDesc = `[${path.dirname(relativeTarget)}]`;
        }

        let notice = '';
        if (destinationPath.endsWith('.js')) {
          try {
            delete require.cache[require.resolve(destinationPath)];
          } catch {}
        }

        if (relativeTarget.startsWith('plugins/') && destinationPath.endsWith('.js')) {
          try {
            const reloadedPlugin = require(destinationPath);
            if (reloadedPlugin && (reloadedPlugin.command || reloadedPlugin.run)) {
              const pluginRelative = path.relative(path.join(rootDir, 'plugins'), destinationPath).replace(/\\/g, '/');
              reloadedPlugin.filename = pluginRelative;
              plugins.set(pluginRelative, reloadedPlugin);
              const cmdList = Array.isArray(reloadedPlugin.command)
                ? reloadedPlugin.command.join(', ')
                : String(reloadedPlugin.command || 'custom');
              notice = ` ⚡ (Plugin Aktif: [${cmdList}])`;
            }
          } catch (loadErr) {
            notice = ` ⚠️ (Gagal reload plugin: ${loadErr.message})`;
          }
        } else if (relativeTarget.startsWith('lib/') && destinationPath.endsWith('.js')) {
          notice = ` (Modul Lib Tersimpan)`;
        } else if (!relativeTarget.includes('/') && destinationPath.endsWith('.js')) {
          notice = ` (Berkas Home Tersimpan)`;
        }

        const statusLabel = isExisting ? '🔄 Diperbarui' : '✨ Ditambahkan';
        const fileSize = Buffer.byteLength(item.content, 'utf8');
        summaryList.push(`• *${statusLabel}* \`${locationDesc}\`: \`${relativeTarget}\` (${fileSize} B)${notice}`);
      }

      const gistDescription = gistData.description ? `\n• Deskripsi: _${gistData.description}_` : '';
      const replyMessage =
        `✅ *PEMBARUAN GIST SELESAI!*\n\n` +
        `📦 *Informasi Gist:*\n` +
        `• ID: \`${gistId}\`\n` +
        `• Pemilik: @${gistData.owner?.login || 'Anonim'}${gistDescription}\n` +
        `• Total File Diproses: ${filesToProcess.length}\n\n` +
        `📝 *Daftar File:*\n` +
        summaryList.join('\n') +
        `\n\n_Semua berkas telah disimpan dan diterapkan ke sistem._`;

      return m.reply(replyMessage);
    } catch (err) {
      console.error('Update Gist error:', err);
      if (err.response?.status === 404) {
        return m.reply(`❌ Gist dengan ID \`${gistId}\` tidak ditemukan atau bersifat rahasia/private.`);
      }
      return m.reply(`❌ Gagal memperbarui dari Gist:\nDetail: ${err.message}`);
    }
  },
  resolveDestination,
  parseGistFiles
};

