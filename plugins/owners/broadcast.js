/**
 * Plugin: Broadcast Announcement
 * Access: Owner Only
 * Commands: broadcast, bc, bcgc
 */

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  command: ['broadcast', 'bc', 'bcgc'],
  tags: ['owners'],
  help: ['bcgc <text / reply media>', 'bc <text / reply media>'],
  description: 'Broadcast announcement to all groups (bcgc) or all chats (bc)',
  isOwner: true,

  run: async (m, { sock, text, command, config }) => {
    const isGroupOnly = command === 'bcgc';

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
    }

    const broadcastText = text || mediaMsg?.text || '';

    if (!broadcastText && !mediaMsg) {
      return m.reply(
        `⚠️ *Usage Instructions for Broadcast:*\n\n` +
        `• *Broadcast to all groups:* \`.bcgc Your announcement message here\`\n` +
        `• *Broadcast with photo/media:* Reply to an image/video with \`.bcgc [caption]\`\n` +
        `• *Broadcast to all chats:* \`.bc Your announcement message\``
      );
    }

    let mediaBuffer = null;
    if (mediaMsg && typeof mediaMsg.download === 'function') {
      mediaBuffer = await mediaMsg.download().catch(() => null);
    }

    await m.reply('⏳ *Fetching recipient list and starting broadcast...*');

    const targets = [];
    try {
      const groups = await sock.groupFetchAllParticipating();
      for (const jid of Object.keys(groups)) {
        targets.push({ jid, name: groups[jid]?.subject || 'Group' });
      }
    } catch {}

    if (!isGroupOnly && sock.chats) {
      for (const jid of Object.keys(sock.chats)) {
        if (jid.endsWith('@s.whatsapp.net') && !targets.some(t => t.jid === jid)) {
          targets.push({ jid, name: 'Private Chat' });
        }
      }
    }

    if (targets.length === 0) {
      return m.reply('❌ No active recipient groups or chats found to broadcast to.');
    }

    await m.reply(`📢 *Broadcasting to ${targets.length} destination(s)... Please wait.*`);

    let successCount = 0;
    let failCount = 0;

    const formattedMessage =
      `*───「 📢 BROADCAST ANNOUNCEMENT 」───*\n\n` +
      `${broadcastText}\n\n` +
      `_Sent by Bot Owner: ${config.ownerName || 'Owner'}_`;

    for (const target of targets) {
      try {
        if (mediaBuffer && mediaType === 'image') {
          await sock.sendMessage(target.jid, {
            image: mediaBuffer,
            caption: formattedMessage
          });
        } else if (mediaBuffer && mediaType === 'video') {
          await sock.sendMessage(target.jid, {
            video: mediaBuffer,
            caption: formattedMessage
          });
        } else if (mediaBuffer && mediaType === 'audio') {
          await sock.sendMessage(target.jid, {
            audio: mediaBuffer,
            mimetype: 'audio/mp4'
          });
          if (broadcastText) {
            await sock.sendMessage(target.jid, { text: formattedMessage });
          }
        } else {
          await sock.sendMessage(target.jid, { text: formattedMessage });
        }

        successCount++;
        await sleep(1200);
      } catch (e) {
        failCount++;
      }
    }

    return m.reply(
      `📊 *Broadcast Completed!*\n\n` +
      `• *Total Targets:* ${targets.length}\n` +
      `• *Successful:* ${successCount} sent\n` +
      `• *Failed:* ${failCount}\n` +
      `• *Destination:* ${isGroupOnly ? 'Groups Only' : 'All Chats'}`
    );
  }
};
