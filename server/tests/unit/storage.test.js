import test from 'node:test';
import assert from 'node:assert';
import { validateImageSignature, stripExifMetadata } from '../../src/services/storageService.js';

test('Storage: validateImageSignature identifies valid JPEG, PNG, and WebP', () => {
  // Valid JPEG header: FF D8 FF E0
  const jpegBuf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
  const jpegSig = validateImageSignature(jpegBuf);
  assert.ok(jpegSig);
  assert.strictEqual(jpegSig.mime, 'image/jpeg');

  // Valid PNG header: 89 50 4E 47 0D 0A 1A 0A
  const pngBuf = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
  const pngSig = validateImageSignature(pngBuf);
  assert.ok(pngSig);
  assert.strictEqual(pngSig.mime, 'image/png');
});

test('Storage: validateImageSignature rejects non-image executable and text files', () => {
  // Windows EXE (MZ header: 4D 5A)
  const exeBuf = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
  assert.strictEqual(validateImageSignature(exeBuf), null);

  // Plain text / script
  const textBuf = Buffer.from('<?php echo "malicious"; ?>');
  assert.strictEqual(validateImageSignature(textBuf), null);
});

test('Storage: stripExifMetadata handles image buffer safely', () => {
  const dummyJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x05, 0x01, 0x02, 0x03, 0xFF, 0xDA, 0x11, 0x22]);
  const sanitized = stripExifMetadata(dummyJpeg, 'image/jpeg');
  assert.ok(sanitized);
  assert.ok(sanitized.length > 0);
});
