/**
 * Configuration File - WhatsApp Bot 
 */

module.exports = {
  owner: ['6288704738182'],

  // Bot Name & Owner
  botName: 'Zettai Bot',
  ownerName: 'KazeDevID / Owner',

  // Command prefix (array or single string)
  prefix: ['.', '#', '!', '/'],

  // Bot Mode: false = public (anyone can use it), true = self (only owner)
  selfMode: true,

  // Baileys login session storage folder name
  sessionName: 'session',

  // Login Mode: 'pairing' for 8 digit pairing code (without QR scan), 'qr' for QR scan
  authMode: 'pairing',

  botNumber: '', // REPLACE WITH YOUR WA BOT NUMBER (without + or spaces, example: 6281234567890)

  // Text bot response
  msg: {
    wait: '⏳ Processing, please wait...',
    ownerOnly: '⚠️ This feature is for the bot Owner only!',
    groupOnly: '⚠️ This feature can only be used in groups!',
    privateOnly: '⚠️ This feature can only be used in private chat!',
    adminOnly: '⚠️ This feature can only be used by Group Admins!',
    superAdminOnly: '⚠️ This feature is exclusively for the Group Creator (Superadmin)!',
    botAdmin: '⚠️ Please promote the bot to Group Admin first!',
    error: '❌ A system error occurred.'
  }
};
