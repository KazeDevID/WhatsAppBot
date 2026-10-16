/**
 * Plugin: Promote Member to Admin
 * Target: Tag / Reply / Number
 * Access: Admin & Superadmin (Bot must be admin)
 */

module.exports = {
  command: ['promote', 'pm', 'admin'],
  tags: ['group'],
  help: ['promote <tag/reply/number>'],
  description: 'Promote a member to group admin (via tag, reply, or number)',
  isGroup: true,
  isAdmin: true,
  isBotAdmin: true,

  run: async (m, { sock, getTarget, participants }) => {
    const target = getTarget();

    if (!target.jid) {
      return m.reply(
        '⚠️ *Target not found!*\n\n' +
        'Use one of the following methods:\n' +
        '• Tag user: `.promote @6281234567890`\n' +
        '• Reply to target\'s message: Type `.promote` on their message\n' +
        '• Type number: `.promote 6281234567890`'
      );
    }

    const targetNum = target.number;

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

    if (participant.admin) {
      return m.reply(`⚠️ User @${targetNum} is already a group admin!`, null, {
        mentions: [target.jid]
      });
    }

    try {
      await sock.groupParticipantsUpdate(m.chat, [target.jid], 'promote');
      return m.reply(`🎉 Congratulations! @${targetNum} has been promoted to *Group Admin*.`, null, {
        mentions: [target.jid]
      });
    } catch (err) {
      return m.reply(`❌ Failed to promote admin: ${err.message}`);
    }
  }
};

