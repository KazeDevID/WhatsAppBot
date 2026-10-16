/**
 * Plugin: Kick Member from Group
 * Target: Tag / Reply / Number
 * Access: Admin & Superadmin (Bot must be admin)
 */

module.exports = {
  command: ['kick', 'tendang', 'remove'],
  tags: ['group'],
  help: ['kick <tag/reply/number>'],
  description: 'Remove member from group (via tag, reply, or number)',
  isGroup: true,
  isAdmin: true,
  isBotAdmin: true,

  run: async (m, { sock, args, text, getTarget, participants, groupMetadata, isSuperAdmin, isOwner, config }) => {
    const target = getTarget();

    if (!target.jid) {
      return m.reply(
        '⚠️ *Target not found!*\n\n' +
        'Use one of the following methods:\n' +
        '• Tag user: `.kick @6281234567890`\n' +
        '• Reply to target\'s message: Type `.kick` on their message\n' +
        '• Type number: `.kick 6281234567890`'
      );
    }

    const botJid = sock.decodeJid(sock.user?.id || '');
    const cleanBot = botJid.replace(/[^0-9]/g, '').split('@')[0];
    const targetNum = target.number;

    if (target.jid === botJid || targetNum === cleanBot) {
      return m.reply('❌ The bot cannot kick itself! Use the `.leave` command if you want the bot to leave.');
    }

    const isMember = participants.some(p => {
      const pJid = sock.decodeJid(p.id);
      const pNum = pJid.replace(/[^0-9]/g, '').split('@')[0];
      return pNum === targetNum || pJid === target.jid;
    });

    if (!isMember) {
      return m.reply(`⚠️ Target @${targetNum} is not found in this group's member list!`, null, {
        mentions: [target.jid]
      });
    }

    const targetParticipant = participants.find(p => {
      const pJid = sock.decodeJid(p.id);
      const pNum = pJid.replace(/[^0-9]/g, '').split('@')[0];
      return pNum === targetNum || pJid === target.jid;
    });

    const isTargetSuperAdmin = Boolean(
      (targetParticipant && targetParticipant.admin === 'superadmin') ||
      (groupMetadata?.owner && sock.decodeJid(groupMetadata.owner) === target.jid)
    );

    if (isTargetSuperAdmin) {
      return m.reply('❌ Cannot remove the Group Creator (Superadmin)!');
    }

    const isTargetAdmin = Boolean(targetParticipant && targetParticipant.admin);
    if (isTargetAdmin && !isSuperAdmin && !isOwner) {
      return m.reply('❌ You cannot remove fellow group admins! Only the Superadmin (Group Creator) can remove admins.');
    }

    const ownerList = (Array.isArray(config.owner) ? config.owner : [config.owner])
      .map(n => String(n).replace(/[^0-9]/g, ''));
    if (ownerList.includes(targetNum)) {
      return m.reply('❌ Cannot remove the Bot Owner from the group!');
    }

    try {
      await sock.groupParticipantsUpdate(m.chat, [target.jid], 'remove');
      return m.reply(`✅ Successfully removed @${targetNum} from the group.`, null, {
        mentions: [target.jid]
      });
    } catch (err) {
      return m.reply(`❌ Failed to remove target: ${err.message}`);
    }
  }
};

