/**
 * Plugin: Add Member to Group
 * Requirement: Requires phone number
 * Access: Admin & Superadmin (Bot must be admin)
 */

module.exports = {
  command: ['add', 'tambah', 'invite'],
  tags: ['group'],
  help: ['add <phone_number>'],
  description: 'Add member to group using phone number',
  isGroup: true,
  isAdmin: true,
  isBotAdmin: true,

  run: async (m, { sock, args, text, participants }) => {
    const input = (args[0] || text || '').trim();
    let cleanNumber = input.replace(/[^0-9]/g, '');

    if (cleanNumber.startsWith('0')) {
      cleanNumber = '62' + cleanNumber.slice(1);
    }

    if (!cleanNumber || cleanNumber.length < 8 || cleanNumber.length > 16) {
      return m.reply(
        '⚠️ *Phone number is required!*\n\n' +
        '• Format: `.add <number>`\n' +
        '• Example: `.add 6281234567890`\n\n' +
        '_Please provide the full number with country code._'
      );
    }

    const targetJid = `${cleanNumber}@s.whatsapp.net`;

    const isAlreadyMember = participants.some(p => {
      const pJid = sock.decodeJid(p.id);
      const pNum = pJid.replace(/[^0-9]/g, '').split('@')[0];
      return pNum === cleanNumber || pJid === targetJid;
    });

    if (isAlreadyMember) {
      return m.reply(`⚠️ Number @${cleanNumber} is already a member of this group!`, null, {
        mentions: [targetJid]
      });
    }

    try {
      const res = await sock.groupParticipantsUpdate(m.chat, [targetJid], 'add');
      const status = res && res[0] ? res[0].status : null;

      if (status === '200') {
        return m.reply(`✅ Successfully added @${cleanNumber} to the group!`, null, {
          mentions: [targetJid]
        });
      } else if (status === '403') {
        try {
          const code = await sock.groupInviteCode(m.chat);
          const inviteLink = `https://chat.whatsapp.com/${code}`;
          await sock.sendMessage(targetJid, {
            text: `Hello! You have been invited to join the group via this link:\n${inviteLink}`
          });
          return m.reply(`⚠️ User @${cleanNumber} has privacy settings preventing direct addition. An invite link has been sent to their private chat.`, null, {
            mentions: [targetJid]
          });
        } catch {
          return m.reply(`⚠️ User @${cleanNumber} has group privacy enabled. Please share the group link manually.`, null, {
            mentions: [targetJid]
          });
        }
      } else if (status === '408') {
        return m.reply(`⚠️ User @${cleanNumber} recently left this group. Please try again later or share an invite link.`, null, {
          mentions: [targetJid]
        });
      } else if (status === '409') {
        return m.reply(`⚠️ Number @${cleanNumber} is already in the group!`, null, {
          mentions: [targetJid]
        });
      } else {
        return m.reply(`✅ Addition request for @${cleanNumber} has been sent. (Status: ${status || 'OK'})`, null, {
          mentions: [targetJid]
        });
      }
    } catch (err) {
      return m.reply(`❌ Failed to add member: ${err.message}`);
    }
  }
};

