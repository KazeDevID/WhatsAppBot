/**
 * Helper: WhatsApp Status Media Processing
 * Handles audio conversion to Opus PTT, waveform extraction, ARGB color assertion,
 * and 30-second duration compliance for WhatsApp Stories.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/**
 * Convert time string (e.g. "45", "01:15", "00:02:30") to seconds
 */
function parseTimeOffset(timeStr) {
  if (!timeStr) return 0;
  const str = String(timeStr).trim();
  if (/^\d+(\.\d+)?$/.test(str)) {
    return Math.max(0, parseFloat(str));
  }
  const parts = str.split(':').map(Number);
  if (parts.length === 2 && !parts.some(isNaN)) {
    return Math.max(0, parts[0] * 60 + parts[1]);
  }
  if (parts.length === 3 && !parts.some(isNaN)) {
    return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
  }
  return 0;
}

/**
 * Convert hex color (#RRGGBB or #RGB) to 32-bit unsigned ARGB integer
 */
function hexToArgb(color) {
  if (typeof color === 'number') {
    return color >>> 0;
  }
  let hex = String(color || '#1E1E2E').trim().replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length < 6) {
    hex = hex.padStart(6, '0');
  }
  if (hex.length === 6) {
    hex = 'FF' + hex;
  }
  return parseInt(hex, 16) >>> 0;
}

/**
 * Get media duration in seconds using ffprobe
 */
function getMediaDuration(filePath) {
  try {
    const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    const out = execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'], timeout: 10000 }).toString().trim();
    const duration = parseFloat(out);
    return isNaN(duration) ? 30 : duration;
  } catch (err) {
    return 30;
  }
}

/**
 * Generate 64-bar waveform (Uint8Array) from audio PCM samples
 */
function generateWaveform(filePath) {
  const samples = 64;
  const defaultWaveform = new Uint8Array(samples).fill(30);
  try {
    const cmd = `ffmpeg -v error -i "${filePath}" -ac 1 -ar 8000 -f s16le -`;
    const rawPcm = execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'], maxBuffer: 15 * 1024 * 1024, timeout: 15000 });
    if (!rawPcm || rawPcm.length < 2) return defaultWaveform;

    const waveform = new Uint8Array(samples);
    const int16 = new Int16Array(rawPcm.buffer, rawPcm.byteOffset, Math.floor(rawPcm.length / 2));
    if (int16.length === 0) return defaultWaveform;

    const blockSize = Math.max(1, Math.floor(int16.length / samples));
    let maxVal = 0;
    const averages = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      let sum = 0;
      const start = i * blockSize;
      const end = Math.min(start + blockSize, int16.length);
      for (let j = start; j < end; j++) {
        sum += Math.abs(int16[j]);
      }
      const count = Math.max(1, end - start);
      const avg = sum / count;
      averages[i] = avg;
      if (avg > maxVal) maxVal = avg;
    }

    for (let i = 0; i < samples; i++) {
      if (maxVal > 0) {
        const norm = (averages[i] / maxVal) * 90 + 5;
        waveform[i] = Math.min(100, Math.max(5, Math.round(norm)));
      } else {
        waveform[i] = 30;
      }
    }
    return waveform;
  } catch (err) {
    return defaultWaveform;
  }
}

/**
 * Process any audio buffer into WhatsApp-compliant Opus Voice Status
 * Standard: audio/ogg; codecs=opus, 48kHz, mono, max 30s, waveform, ARGB background
 */
async function processAudioForStatus(buffer, options = {}) {
  const uid = crypto.randomBytes(6).toString('hex');
  const tmpIn = path.join(os.tmpdir(), `status_audio_in_${uid}.tmp`);
  const tmpOut = path.join(os.tmpdir(), `status_audio_out_${uid}.ogg`);

  try {
    fs.writeFileSync(tmpIn, buffer);
    const originalDuration = getMediaDuration(tmpIn);

    const startTime = Math.min(parseTimeOffset(options.startTime), Math.max(0, originalDuration - 1));
    const maxDuration = Math.min(Math.max(5, Number(options.duration) || 30), 60);
    const targetDuration = Math.min(Math.max(1, originalDuration - startTime), maxDuration);

    const cmd = `ffmpeg -y -ss ${startTime} -i "${tmpIn}" -t ${targetDuration} -c:a libopus -b:a 48k -ar 48000 -ac 1 -vn "${tmpOut}"`;
    execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'], timeout: 20000 });

    const finalBuffer = fs.readFileSync(tmpOut);
    const processedDuration = getMediaDuration(tmpOut);
    const waveform = generateWaveform(tmpOut);

    const color = options.color || '#1E1E2E';
    const backgroundArgb = hexToArgb(color);

    return {
      buffer: finalBuffer,
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true,
      seconds: Math.max(1, Math.round(processedDuration)),
      waveform,
      backgroundArgb,
      color,
      originalDuration: Math.round(originalDuration),
      processedDuration: Math.round(processedDuration),
      startTime
    };
  } finally {
    try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch {}
    try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch {}
  }
}

/**
 * Generate 720x1280 (9:16 portrait) MP4 video status from an audio track
 */
async function createVideoStatusFromAudio(buffer, options = {}) {
  const uid = crypto.randomBytes(6).toString('hex');
  const tmpIn = path.join(os.tmpdir(), `status_vid_in_${uid}.tmp`);
  const tmpOut = path.join(os.tmpdir(), `status_vid_out_${uid}.mp4`);

  try {
    fs.writeFileSync(tmpIn, buffer);
    const originalDuration = getMediaDuration(tmpIn);

    const startTime = Math.min(parseTimeOffset(options.startTime), Math.max(0, originalDuration - 1));
    const maxDuration = Math.min(Math.max(5, Number(options.duration) || 30), 30);
    const targetDuration = Math.min(Math.max(1, originalDuration - startTime), maxDuration);

    const rawColor = String(options.color || '#1E1E2E').replace('#', '');
    const cleanColor = rawColor.length === 6 ? rawColor : '1E1E2E';

    const cmd = `ffmpeg -y -ss ${startTime} -i "${tmpIn}" -t ${targetDuration} -f lavfi -i color=c=0x${cleanColor}:s=720x1280 -c:v libx264 -preset ultrafast -tune stillimage -c:a aac -b:a 128k -pix_fmt yuv420p -shortest "${tmpOut}"`;
    execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'], timeout: 25000 });

    const finalBuffer = fs.readFileSync(tmpOut);
    const processedDuration = getMediaDuration(tmpOut);

    return {
      buffer: finalBuffer,
      mimetype: 'video/mp4',
      seconds: Math.round(processedDuration),
      originalDuration: Math.round(originalDuration),
      processedDuration: Math.round(processedDuration),
      startTime
    };
  } finally {
    try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch {}
    try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch {}
  }
}

/**
 * Validate and trim video for WhatsApp Status (max 30 seconds limit)
 */
async function processVideoForStatus(buffer, options = {}) {
  const uid = crypto.randomBytes(6).toString('hex');
  const tmpIn = path.join(os.tmpdir(), `status_video_in_${uid}.mp4`);
  const tmpOut = path.join(os.tmpdir(), `status_video_out_${uid}.mp4`);

  try {
    fs.writeFileSync(tmpIn, buffer);
    const originalDuration = getMediaDuration(tmpIn);

    if (originalDuration <= 30) {
      return {
        buffer,
        mimetype: 'video/mp4',
        seconds: Math.round(originalDuration),
        trimmed: false
      };
    }

    const startTime = Math.min(parseTimeOffset(options.startTime), Math.max(0, originalDuration - 1));
    const targetDuration = Math.min(Math.max(1, originalDuration - startTime), 30);

    const cmd = `ffmpeg -y -ss ${startTime} -i "${tmpIn}" -t ${targetDuration} -c:v libx264 -preset ultrafast -c:a aac -pix_fmt yuv420p "${tmpOut}"`;
    execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'], timeout: 30000 });

    const finalBuffer = fs.readFileSync(tmpOut);
    return {
      buffer: finalBuffer,
      mimetype: 'video/mp4',
      seconds: Math.round(targetDuration),
      trimmed: true,
      originalDuration: Math.round(originalDuration)
    };
  } finally {
    try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch {}
    try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch {}
  }
}

module.exports = {
  parseTimeOffset,
  hexToArgb,
  getMediaDuration,
  generateWaveform,
  processAudioForStatus,
  createVideoStatusFromAudio,
  processVideoForStatus
};
