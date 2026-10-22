import test from 'node:test';
import assert from 'node:assert';
import { reportSubmissionSchema, thresholdSettingsSchema, adminLoginSchema } from '../../src/schemas/index.js';
import { normalizePlace, generateReferenceId, hashIp } from '../../src/utils/normalizer.js';

test('Validation: reportSubmissionSchema validates valid report', () => {
  const validReport = {
    place_original: 'KPHB Metro Station',
    place_landmark: 'Exit B near stairs',
    incident_time: new Date().toISOString(),
    incident_time_approx: false,
    category: 'harassment',
    description: 'Group of men loitering and passing remarks continuously.',
    reporter_contact: 'safe_contact@example.org'
  };

  const result = reportSubmissionSchema.safeParse(validReport);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.data.category, 'harassment');
});

test('Validation: reportSubmissionSchema rejects short descriptions or invalid categories', () => {
  const invalidCategory = {
    place_original: 'KPHB Metro',
    incident_time: new Date().toISOString(),
    category: 'invalid_type_not_allowed',
    description: 'Tiny'
  };

  const result = reportSubmissionSchema.safeParse(invalidCategory);
  assert.strictEqual(result.success, false);
  const errors = result.error.issues.map(i => i.path[0]);
  assert.ok(errors.includes('category'));
  assert.ok(errors.includes('description'));
});

test('Validation: thresholdSettingsSchema enforces boundary conditions', () => {
  const invalidThreshold = {
    threshold: 0, // must be >= 1
    window_hours: 200 // max 168
  };

  const result = thresholdSettingsSchema.safeParse(invalidThreshold);
  assert.strictEqual(result.success, false);

  const validSettings = {
    threshold: 5,
    window_hours: 24
  };
  const validResult = thresholdSettingsSchema.safeParse(validSettings);
  assert.strictEqual(validResult.success, true);
});

test('Normalizer: cleans punctuation, extra spaces, and handles case-insensitivity', () => {
  assert.strictEqual(normalizePlace('  K.P.H.B. - Metro  '), 'kphb metro');
  assert.strictEqual(normalizePlace('kphb  metro station'), 'kphb metro station');
  assert.strictEqual(normalizePlace('HITEC CITY, Mindspace!'), 'hitec city mindspace');
  assert.strictEqual(normalizePlace(''), '');
});

test('Utils: generateReferenceId produces format SFR-YYYY-XXXXXX', () => {
  const id = generateReferenceId();
  const currentYear = new Date().getFullYear();
  assert.match(id, new RegExp(`^SFR-${currentYear}-[A-F0-9]{6}$`));
});

test('Utils: hashIp produces deterministic 32-character hash without exposing IP', () => {
  const hash1 = hashIp('192.168.1.50');
  const hash2 = hashIp('192.168.1.50');
  const hash3 = hashIp('10.0.0.1');

  assert.strictEqual(hash1, hash2);
  assert.notStrictEqual(hash1, hash3);
  assert.strictEqual(hash1.length, 32);
});
