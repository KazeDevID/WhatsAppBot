/**
 * Image processing utilities for WhatsApp Bot
 * Provides full profile picture generation (PP Panjang) and framing
 */
const sharp = require('sharp');
const { S_WHATSAPP_NET } = require('baileys');

/**
 * Generate full profile picture (PP Panjang) without square cropping
 * Always generates an exact 1:1 square canvas (640x640) acceptable by WhatsApp servers
 * 
 * @param {Buffer} buffer Original image buffer
 * @param {object} options
 * @param {boolean} options.blurBackground Use aesthetic blurred background (default: true)
 * @param {number} options.maxDimension Maximum square canvas dimension (default: 640)
 * @returns {Promise<Buffer>} Standard WhatsApp-compliant 640x640 JPEG buffer
 */
async function generateFullProfilePicture(buffer, options = {}) {
  const { blurBackground = true, maxDimension = 640 } = options;
  const image = sharp(buffer);
  const meta = await image.metadata();

  const maxDim = Math.min(Math.max(meta.width || 640, meta.height || 640, 640), maxDimension, 720);

  const foreground = await sharp(buffer)
    .resize(maxDim, maxDim, { fit: 'inside' })
    .toBuffer();

  const fgMeta = await sharp(foreground).metadata();
  const left = Math.round((maxDim - (fgMeta.width || maxDim)) / 2);
  const top = Math.round((maxDim - (fgMeta.height || maxDim)) / 2);

  let background;

  if (blurBackground) {
    background = await sharp(buffer)
      .resize(maxDim, maxDim, { fit: 'cover' })
      .blur(20)
      .modulate({ brightness: 0.7, saturation: 1.15 })
      .toBuffer();
  } else {
    background = await sharp({
      create: {
        width: maxDim,
        height: maxDim,
        channels: 3,
        background: { r: 17, g: 27, b: 33 }
      }
    }).jpeg().toBuffer();
  }

  return await sharp(background)
    .composite([{ input: foreground, left, top }])
    .jpeg({ quality: 80 })
    .toBuffer();
}

/**
 * Set full profile picture (PP Panjang) to WhatsApp
 * Works for both bot profile (1:1) and group profile
 * @param {object} sock Baileys socket instance
 * @param {string} jid Target JID (group JID or bot JID)
 * @param {Buffer} imageBuffer Original image buffer
 * @param {object} options
 */
async function setFullProfilePicture(sock, jid, imageBuffer, options = {}) {
  const jpegBuffer = await generateFullProfilePicture(imageBuffer, options);

  const meId = sock.user?.id || sock.authState?.creds?.me?.id || '';
  const decodedMe = sock.decodeJid ? sock.decodeJid(meId) : meId.replace(/:\d+@/, '@');
  const decodedTarget = sock.decodeJid ? sock.decodeJid(jid) : jid?.replace(/:\d+@/, '@');

  const isSelf = !decodedTarget || decodedTarget === decodedMe || decodedTarget.startsWith((decodedMe || '').split('@')[0]);
  const targetJid = isSelf ? undefined : decodedTarget;

  try {
    if (typeof sock.updateProfilePicture === 'function') {
      const target = isSelf ? (decodedMe || jid) : targetJid;
      await sock.updateProfilePicture(target, jpegBuffer);
      return { success: true, buffer: jpegBuffer };
    }
  } catch (nativeErr) {
    console.warn('[PP Panjang] Native updateProfilePicture failed, attempting direct IQ stanza fallback:', nativeErr.message);
  }

  const targetDomain = S_WHATSAPP_NET || '@s.whatsapp.net';
  await sock.query({
    tag: 'iq',
    attrs: {
      to: targetDomain,
      type: 'set',
      xmlns: 'w:profile:picture',
      ...(targetJid ? { target: targetJid } : {})
    },
    content: [
      {
        tag: 'picture',
        attrs: { type: 'image' },
        content: jpegBuffer
      }
    ]
  });

  return { success: true, buffer: jpegBuffer };
}

module.exports = {
  generateFullProfilePicture,
  setFullProfilePicture
};
