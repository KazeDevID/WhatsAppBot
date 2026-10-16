/**
 * Plugin: Upload WhatsApp Status / Story (UPSW)
 * Access: Owner Only
 * Supported Media: Text, Image, Video (HD 30s), Audio/Music (Voice Story & Video Story)
 */

const {
  parseTimeOffset,
  hexToArgb,
  processAudioForStatus,
  createVideoStatusFromAudio,
  processVideoForStatus
} = require('../../lib/statusMedia');

const STATUS_COLORS = [
  '#00796B', '#D32F2F', '#512DA8', '#1976D2', '#E64A19',
  '#303F9F', '#C2185B', '#388E3C', '#F57C00', '#455A64',
  '#1E1E2E', '#2E7D32', '#6A1B9A', '#0288D1', '#D81B60'
];

/**
 * Gather comprehensive list of recipient JIDs to distribute status encryption keys
 * Collects bot owners, current sender, recent chats, synced contacts, and group participants
 */
async function getStatusRecipients(sock, config, m, targetList = []) {
  const recipientSet = new Set();

  if (m && m.sender) {
    const clean = String(m.sender).split(':')[0].replace(/[^0-9]/g, '');
    if (clean) recipientSet.add(`${clean}@s.whatsapp.net`);
  }

  if (m && !m.isGroup && m.chat && m.chat.endsWith('@s.whatsapp.net')) {
    const clean = String(m.chat).split(':')[0].replace(/[^0-9]/g, '');
    if (clean) recipientSet.add(`${clean}@s.whatsapp.net`);
  }

  const owners = Array.isArray(config.owner) ? config.owner : [config.owner];
  for (const o of owners) {
    const clean = String(o).split(':')[0].replace(/[^0-9]/g, '');
    if (clean) recipientSet.add(`${clean}@s.whatsapp.net`);
  }

  const me = sock.user?.id || sock.authState?.creds?.me?.id;
  if (me) {
    const clean = String(me).split(':')[0].replace(/[^0-9]/g, '');
    if (clean) recipientSet.add(`${clean}@s.whatsapp.net`);
  }

  if (Array.isArray(targetList) && targetList.length) {
    for (const t of targetList) {
      const clean = String(t).split(':')[0].replace(/[^0-9]/g, '');
      if (clean) recipientSet.add(`${clean}@s.whatsapp.net`);
    }
  }

  if (config.contacts && config.contacts.size) {
    for (const jid of config.contacts) {
      const clean = String(jid).split(':')[0].replace(/[^0-9]/g, '');
      if (clean) recipientSet.add(`${clean}@s.whatsapp.net`);
    }
  }

  if (config.recentChats && config.recentChats.size) {
    for (const jid of config.recentChats) {
      const clean = String(jid).split(':')[0].replace(/[^0-9]/g, '');
      if (clean) recipientSet.add(`${clean}@s.whatsapp.net`);
    }
  }

  try {
    if (typeof sock.groupFetchAllParticipating === 'function') {
      const groups = await sock.groupFetchAllParticipating();
      if (groups && typeof groups === 'object') {
        for (const groupId of Object.keys(groups)) {
          const participants = groups[groupId]?.participants;
          if (Array.isArray(participants)) {
            for (const p of participants) {
              const pJid = p?.id || p?.jid;
              if (pJid && (pJid.endsWith('@s.whatsapp.net') || !pJid.includes('@'))) {
                const clean = String(pJid).split(':')[0].replace(/[^0-9]/g, '');
                if (clean) recipientSet.add(`${clean}@s.whatsapp.net`);
              }
            }
          }
        }
      }
    }
  } catch (err) {
  }

  const allList = Array.from(recipientSet);
  return allList.slice(0, 800);
}

module.exports = {
  command: ['upsw', 'status', 'sw', 'story'],
  tags: ['owners'],
  help: ['upsw <text / reply media>'],
  description: 'Upload WhatsApp Status/Story (supports text, image, HD video, music, and audio)',
  isOwner: true,

  run: async (m, { sock, args, text, config }) => {
    let mediaMsg = null;
    let mediaType = null;

    if (m.quoted) {
      if (m.quoted.type === 'imageMessage' || m.quoted.message?.imageMessage) {
        mediaMsg = m.quoted;
        mediaType = 'image';
      } else if (m.quoted.type === 'videoMessage' || m.quoted.message?.videoMessage) {
        mediaMsg = m.quoted;
        mediaType = 'video';
      } else if (m.quoted.type === 'audioMessage' || m.quoted.message?.audioMessage) {
        mediaMsg = m.quoted;
        mediaType = 'audio';
      }
    } else {
      if (m.type === 'imageMessage' || m.message?.imageMessage) {
        mediaMsg = m;
        mediaType = 'image';
      } else if (m.type === 'videoMessage' || m.message?.videoMessage) {
        mediaMsg = m;
        mediaType = 'video';
      } else if (m.type === 'audioMessage' || m.message?.audioMessage) {
        mediaMsg = m;
        mediaType = 'audio';
      }
    }

    const rawText = text || '';

    const colorMatch = rawText.match(/--color\s+(#[0-9a-fA-F]{3,6})/i);
    const fontMatch = rawText.match(/--font\s+([1-5])/);
    const startMatch = rawText.match(/--start\s+([0-9:]+)/i);
    const durMatch = rawText.match(/--(?:dur|duration|time)\s+([0-9]+)/i);
    const wantsVideo = /--(?:video|vid)\b/i.test(rawText);

    const targetNumbers = [];
    const targetMatch = rawText.match(/--to\s+([0-9,\s+]+)/i);
    if (targetMatch) {
      const nums = targetMatch[1].split(/[\s,]+/);
      for (const n of nums) {
        const clean = n.replace(/[^0-9]/g, '');
        if (clean.length >= 6) targetNumbers.push(`${clean}@s.whatsapp.net`);
      }
    }
    if (Array.isArray(m.mentionedJid)) {
      targetNumbers.push(...m.mentionedJid);
    }

    const selectedColor = colorMatch ? colorMatch[1] : STATUS_COLORS[Math.floor(Math.random() * STATUS_COLORS.length)];
    const selectedFont = fontMatch ? parseInt(fontMatch[1], 10) : 1;
    const startTime = startMatch ? startMatch[1] : '0';
    const durationLimit = durMatch ? parseInt(durMatch[1], 10) : 30;

    const cleanContent = rawText
      .replace(/--(?:color|font|start|dur|duration|time|to)\s+\S+/gi, '')
      .replace(/--(?:video|vid)\b/gi, '')
      .trim();

    await m.reply('⏳ *Processing and uploading story to WhatsApp Status...*');

    try {
      const statusJidList = await getStatusRecipients(sock, config, m, targetNumbers);

      if (mediaMsg && mediaType) {
        let buffer = null;
        if (typeof mediaMsg.download === 'function') {
          buffer = await mediaMsg.download();
        }

        if (!buffer || buffer.length === 0) {
          return m.reply('❌ Failed to download media for status. Please resend or try another media.');
        }

        const caption = cleanContent || (mediaMsg.text || '');

        if (mediaType === 'image') {
          await sock.sendMessage('status@broadcast', {
            image: buffer,
            caption
          }, { statusJidList });

          return m.reply(
            `✅ *Successfully uploaded Image Status!*\n\n` +
            `• *Type:* Image Story\n` +
            `• *Recipients:* ${statusJidList.length} contact(s)\n` +
            (caption ? `• *Caption:* ${caption}\n` : '') +
            `• *Time:* ${new Date().toLocaleTimeString('en-US')}`
          );
        }

        if (mediaType === 'video') {
          const processedVid = await processVideoForStatus(buffer, {
            startTime
          });

          await sock.sendMessage('status@broadcast', {
            video: processedVid.buffer,
            caption
          }, { statusJidList });

          return m.reply(
            `✅ *Successfully uploaded Video Status!*\n\n` +
            `• *Type:* HD Video Story\n` +
            `• *Duration:* ${processedVid.seconds}s ${processedVid.trimmed ? '(Trimmed to 30s limit)' : ''}\n` +
            `• *Size:* ${(processedVid.buffer.length / (1024 * 1024)).toFixed(2)} MB\n` +
            `• *Recipients:* ${statusJidList.length} contact(s)\n` +
            (caption ? `• *Caption:* ${caption}\n` : '') +
            `• *Time:* ${new Date().toLocaleTimeString('en-US')}`
          );
        }

        if (mediaType === 'audio') {
          if (wantsVideo) {
            const vidStory = await createVideoStatusFromAudio(buffer, {
              startTime,
              duration: durationLimit,
              color: selectedColor
            });

            await sock.sendMessage('status@broadcast', {
              video: vidStory.buffer,
              caption
            }, { statusJidList });

            return m.reply(
              `✅ *Successfully uploaded Music Video Status!*\n\n` +
              `• *Type:* Video Story (from Audio)\n` +
              `• *Duration:* ${vidStory.seconds}s (From ${startTime})\n` +
              `• *Card Color:* ${selectedColor}\n` +
              `• *Size:* ${(vidStory.buffer.length / 1024).toFixed(1)} KB\n` +
              `• *Recipients:* ${statusJidList.length} contact(s)\n` +
              (caption ? `• *Caption:* ${caption}\n` : '') +
              `• *Time:* ${new Date().toLocaleTimeString('en-US')}`
            );
          }

          const processedAudio = await processAudioForStatus(buffer, {
            startTime,
            duration: durationLimit,
            color: selectedColor
          });

          await sock.sendMessage('status@broadcast', {
            audio: processedAudio.buffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true,
            seconds: processedAudio.seconds,
            waveform: processedAudio.waveform,
            backgroundArgb: processedAudio.backgroundArgb
          }, {
            statusJidList,
            backgroundColor: processedAudio.color
          });

          return m.reply(
            `✅ *Successfully uploaded Audio Voice Status!*\n\n` +
            `• *Type:* Native WhatsApp Voice Story (Opus PTT)\n` +
            `• *Duration:* ${processedAudio.seconds}s ${processedAudio.startTime > 0 ? `(From ${processedAudio.startTime}s)` : ''}\n` +
            `• *Card Color:* ${processedAudio.color}\n` +
            `• *Waveform:* Rendered (64-bar Amplitude)\n` +
            `• *Optimized Size:* ${(processedAudio.buffer.length / 1024).toFixed(1)} KB (From ${(buffer.length / 1024).toFixed(1)} KB)\n` +
            `• *Recipients:* ${statusJidList.length} contact(s)\n` +
            `• *Time:* ${new Date().toLocaleTimeString('en-US')}\n\n` +
            `💡 *Tips:*\n` +
            `• Cut specific song part: \`.upsw --start 01:15\`\n` +
            `• Custom card color: \`.upsw --color #D32F2F\`\n` +
            `• Upload as video story: \`.upsw --video\``
          );
        }
      }

      let statusText = cleanContent;
      if (!statusText && m.quoted?.text) {
        statusText = m.quoted.text;
      }

      if (!statusText) {
        return m.reply(
          `⚠️ *Usage Instructions for WhatsApp Status (UPSW):*\n\n` +
          `• *Text Status:* \`.upsw Your status text here\`\n` +
          `• *Text with Custom Color:* \`.upsw --color #D32F2F Your status text\`\n` +
          `• *Image Status:* Reply to an image with \`.upsw [caption]\`\n` +
          `• *Video Status:* Reply to a video with \`.upsw [caption]\`\n` +
          `• *Voice / Music Status:* Reply to an audio with \`.upsw\`\n` +
          `  - Cut chorus: \`.upsw --start 01:20\`\n` +
          `  - Custom color: \`.upsw --color #1E1E2E\`\n` +
          `  - As video story: \`.upsw --video\``
        );
      }

      await sock.sendMessage('status@broadcast', {
        text: statusText
      }, {
        backgroundColor: selectedColor,
        font: selectedFont,
        statusJidList
      });

      return m.reply(
        `✅ *Successfully uploaded Text Status!*\n\n` +
        `• *Text:* ${statusText}\n` +
        `• *Color:* ${selectedColor}\n` +
        `• *Font Style:* #${selectedFont}\n` +
        `• *Recipients:* ${statusJidList.length} contact(s)\n` +
        `• *Time:* ${new Date().toLocaleTimeString('en-US')}`
      );
    } catch (err) {
      return m.reply(`❌ Failed to upload WhatsApp Status: ${err.message}`);
    }
  }
};
