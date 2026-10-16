/**
 * Plugin: Join Group via Link
 * Access: Owner Only
 */

module.exports = {
  command: ['join', 'joingc', 'joingroup'],
  tags: ['owners'],
  help: ['join <invite_link>'],
  description: 'Join a WhatsApp group using an invite link',
  isOwner: true,

  run: async (m, { sock, text }) => {
    if (!text) {
      return m.reply(
        `⚠️ *Please provide a valid WhatsApp group link!*\n\n` +
        `• Example: \`.join https://chat.whatsapp.com/ABC123xyz\``
      );
    }

    const regex = /chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i;
    const match = text.match(regex);

    if (!match || !match[1]) {
      return m.reply('❌ Invalid WhatsApp group invite link format.');
    }

    const inviteCode = match[1];

    try {
      await m.reply('⏳ *Attempting to join group via link...*');
      const groupJid = await sock.groupAcceptInvite(inviteCode);

      if (groupJid) {
        return m.reply(`✅ *Successfully joined the group!*\n\n• *Group JID:* ${groupJid}`);
      } else {
        return m.reply('✅ *Invite accepted successfully!*');
      }
    } catch (err) {
      return m.reply(`❌ Failed to join group: ${err.message || 'Link might be revoked or bot was previously removed.'}`);
    }
  }
};
