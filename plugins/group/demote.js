/**
 * Plugin: Demote Admin to Regular Member
 * Target: Tag / Reply / Number
 * Access: Superadmin & Admin (Bot must be admin)
 */

module.exports = {
  command: ['demote', 'unadmin'],
  tags: ['group'],
  help: ['demote <tag/reply/number>'],
  description: 'Demote an admin to regular member (via tag, reply, or number)',
  isGroup: true,
  isAdmin: true,
  isBotAdmin: true,

  run: async (m, { sock, getTarget, participants, groupMetadata, isSuperAdmin, isOwner }) => {
    const target = getTarget();

    if (!target.jid) {
      return m.reply(
        '⚠️ *Target not found!*\n\n' +
        'Use one of the following methods:\n' +
        '• Tag user: `.demote @6281234567890`\n' +
        '• Reply to target\'s message: Type `.demote` on their message\n' +
        '• Type number: `.demote 6281234567890`'
      );
    }

    const botJid = sock.decodeJid(sock.user?.id || '');
    const cleanBot = botJid.replace(/[^0-9]/g, '').split('@')[0];
    const targetNum = target.number;

    if (target.jid === botJid || targetNum === cleanBot) {
      return m.reply('❌ The bot cannot demote its own admin status.');
    }

    const participant = participants.find(p => {
      const pJid = sock.decodeJid(p.id);
      const pNum = pJid.replace(/[^0-9]/g, '').split('@')[0];
      return pNum === targetNum || pJid === target.jid;
    });

    if (!participant) {
      return m.reply(`⚠️ Number @${targetNum} is not a member of this group!`, null, {
        mentions: [target.jid]
      });
    }

    if (!participant.admin) {
      return m.reply(`⚠️ User @${targetNum} is not a group admin!`, null, {
        mentions: [target.jid]
      });
    }

    const isTargetSuper = Boolean(
      participant.admin === 'superadmin' ||
      (groupMetadata?.owner && sock.decodeJid(groupMetadata.owner) === target.jid)
    );

    if (isTargetSuper) {
      return m.reply('❌ Cannot demote the Group Creator (Superadmin)!');
    }

    if (!isSuperAdmin && !isOwner) {
      return m.reply('❌ Only the Group Creator (Superadmin) is authorized to demote fellow admins!');
    }

    try {
      await sock.groupParticipantsUpdate(m.chat, [target.jid], 'demote');
      return m.reply(`✅ Admin status for @${targetNum} has been revoked to regular member.`, null, {
        mentions: [target.jid]
      });
    } catch (err) {
      return m.reply(`❌ Failed to demote admin: ${err.message}`);
    }
  }
};

