/**
 * Plugin: Group Information & Summary
 * Access: All Group Members
 */

module.exports = {
  command: ['infogc', 'groupinfo', 'gcinfo'],
  tags: ['group'],
  help: ['infogc'],
  description: 'Display complete group information and statistics',
  isGroup: true,

  run: async (m, { sock, groupMetadata, participants, groupAdmins }) => {
    if (!groupMetadata) {
      try {
        groupMetadata = await sock.groupMetadata(m.chat);
      } catch (err) {
        return m.reply(`❌ Failed to fetch group information: ${err.message}`);
      }
    }

    const members = participants.length ? participants : (groupMetadata.participants || []);
    const admins = groupAdmins.length ? groupAdmins : members.filter(p => p.admin).map(p => p.id);
    
    let superAdminJid = groupMetadata.owner || null;
    if (!superAdminJid) {
      const sa = members.find(p => p.admin === 'superadmin');
      if (sa) superAdminJid = sa.id;
    }
    const cleanSuper = superAdminJid ? sock.decodeJid(superAdminJid).replace(/[^0-9]/g, '').split('@')[0] : 'Unknown';

    const creationDate = groupMetadata.creation
      ? new Date(groupMetadata.creation * 1000).toLocaleString('en-US')
      : 'Unknown';

    const isAnnouncement = groupMetadata.announce ? '🔒 Closed (Admins Only)' : '🔓 Open (All Members)';
    const isLocked = groupMetadata.restrict ? '🔒 Admins Only' : '🔓 All Members';
    const isEphemeral = groupMetadata.ephemeralDuration ? `${groupMetadata.ephemeralDuration / 86400} Days` : 'Disabled';

    let textInfo = `📋 *GROUP INFORMATION*\n\n`;
    textInfo += `• *Group Name:* ${groupMetadata.subject || '-'}\n`;
    textInfo += `• *Group ID:* \`${groupMetadata.id}\`\n`;
    textInfo += `• *Creator (Superadmin):* @${cleanSuper}\n`;
    textInfo += `• *Created On:* ${creationDate}\n`;
    textInfo += `• *Total Members:* ${members.length} Members\n`;
    textInfo += `• *Total Admins:* ${admins.length} Admins\n\n`;

    textInfo += `⚙️ *Group Settings:*\n`;
    textInfo += `• Send Messages: ${isAnnouncement}\n`;
    textInfo += `• Edit Group Info: ${isLocked}\n`;
    textInfo += `• Disappearing Messages: ${isEphemeral}\n\n`;

    textInfo += `📝 *Group Description:*\n${groupMetadata.desc || '_(No description yet)_'}`;

    const mentions = superAdminJid ? [sock.decodeJid(superAdminJid)] : [];

    return m.reply(textInfo, null, { mentions });
  }
};

