import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../../');
const STORAGE_DIR = path.resolve(ROOT_DIR, 'storage/uploads');

// Ensure local private storage directory exists if using local driver
if (process.env.STORAGE_DRIVER !== 's3' && !fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Allowed MIME types & magic bytes
const MAGIC_SIGNATURES = [
  { mime: 'image/jpeg', ext: '.jpg', bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png', ext: '.png', bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { mime: 'image/webp', ext: '.webp', check: (buf) => buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP' }
];

let s3ClientInstance = null;
function getS3Client() {
  if (process.env.STORAGE_DRIVER !== 's3') return null;
  if (!s3ClientInstance) {
    const config = {
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || ''
      }
    };
    if (process.env.S3_ENDPOINT) {
      config.endpoint = process.env.S3_ENDPOINT;
      config.forcePathStyle = true;
    }
    s3ClientInstance = new S3Client(config);
  }
  return s3ClientInstance;
}

/**
 * Validates the file buffer against true magic byte signatures.
 * Rejects executable, script, or unrecognized binary data.
 */
export function validateImageSignature(buffer) {
  if (!buffer || buffer.length < 8) return null;

  for (const sig of MAGIC_SIGNATURES) {
    if (sig.bytes) {
      const match = sig.bytes.every((b, i) => buffer[i] === b);
      if (match) return sig;
    } else if (sig.check && sig.check(buffer)) {
      return sig;
    }
  }
  return null;
}

/**
 * Strips EXIF / metadata markers (like APP1 0xFFE1) from JPEG buffer to remove GPS and camera details.
 */
export function stripExifMetadata(buffer, mime) {
  if (mime !== 'image/jpeg') return buffer;

  try {
    let clean = Buffer.alloc(buffer.length);
    let readPos = 2; // skip initial SOI 0xFFD8
    let writePos = 2;
    buffer.copy(clean, 0, 0, 2);

    while (readPos < buffer.length - 1) {
      if (buffer[readPos] === 0xFF) {
        const marker = buffer[readPos + 1];
        if (marker === 0xE1 || (marker >= 0xE2 && marker <= 0xEF)) {
          const length = buffer.readUInt16BE(readPos + 2);
          readPos += 2 + length;
          continue;
        }
        if (marker === 0xDA) {
          buffer.copy(clean, writePos, readPos);
          writePos += (buffer.length - readPos);
          break;
        }
      }
      clean[writePos++] = buffer[readPos++];
    }
    return clean.subarray(0, writePos);
  } catch (err) {
    return buffer;
  }
}

/**
 * Saves an uploaded image file securely to private object storage or local storage.
 * Returns storage metadata.
 */
export async function savePrivateImage(fileBuffer, originalFilename) {
  const verifiedSig = validateImageSignature(fileBuffer);
  if (!verifiedSig) {
    throw new Error('Unsupported or invalid image file format. Only JPEG, PNG, and WebP are accepted.');
  }

  // Strip EXIF metadata
  const sanitizedBuffer = stripExifMetadata(fileBuffer, verifiedSig.mime);
  const storageKey = `${uuidv4()}${verifiedSig.ext}`;

  if (process.env.STORAGE_DRIVER === 's3') {
    const s3 = getS3Client();
    const bucket = process.env.S3_BUCKET;
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: sanitizedBuffer,
      ContentType: verifiedSig.mime,
      ServerSideEncryption: 'AES256'
    }));
  } else {
    const filePath = path.join(STORAGE_DIR, storageKey);
    await fs.promises.writeFile(filePath, sanitizedBuffer);
  }

  return {
    storageKey,
    mimeType: verifiedSig.mime,
    fileSize: sanitizedBuffer.length,
    originalFilename: path.basename(originalFilename).replace(/[^a-zA-Z0-9._-]/g, '_')
  };
}

/**
 * Retrieves a private image stream for authorized admin view.
 */
export async function getPrivateImageStream(storageKey) {
  const safeKey = path.basename(storageKey);

  if (process.env.STORAGE_DRIVER === 's3') {
    try {
      const s3 = getS3Client();
      const bucket = process.env.S3_BUCKET;
      const res = await s3.send(new GetObjectCommand({
        Bucket: bucket,
        Key: safeKey
      }));
      return res.Body;
    } catch (err) {
      console.error('[Storage S3 Error]:', err.message);
      return null;
    }
  } else {
    const filePath = path.join(STORAGE_DIR, safeKey);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return fs.createReadStream(filePath);
  }
}

/**
 * Permanently deletes a private image from storage.
 */
export async function deletePrivateImage(storageKey) {
  const safeKey = path.basename(storageKey);

  if (process.env.STORAGE_DRIVER === 's3') {
    try {
      const s3 = getS3Client();
      const bucket = process.env.S3_BUCKET;
      await s3.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: safeKey
      }));
      return true;
    } catch (err) {
      console.error('[Storage S3 Delete Error]:', err.message);
      return false;
    }
  } else {
    const filePath = path.join(STORAGE_DIR, safeKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
    return false;
  }
}

/**
 * Generates a short-lived HMAC signed token for authorized image access (15 min expiry).
 */
export function generateImageAccessToken(imageId, storageKey, adminId) {
  const expiresAt = Date.now() + 15 * 60 * 1000;
  const secret = process.env.SESSION_SECRET || 'safesignal_image_secret';
  const data = `${imageId}:${storageKey}:${adminId}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ imageId, adminId, expiresAt, sig: hmac })).toString('base64url');
}

/**
 * Verifies short-lived image access token.
 */
export function verifyImageAccessToken(token, imageId) {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf-8');
    const { imageId: tImageId, adminId, expiresAt } = JSON.parse(raw);

    if (tImageId !== imageId || Date.now() > expiresAt) {
      return false;
    }
    return { adminId, expiresAt };
  } catch (e) {
    return false;
  }
}
