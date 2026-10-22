import crypto from 'crypto';

/**
 * Normalizes a place label for clustering and aggregation.
 * Removes acronym dots (e.g. K.P.H.B. -> kphb), lowercases,
 * collapses punctuation and excess whitespace.
 * e.g. "K.P.H.B. - Metro Station!" -> "kphb metro station"
 * e.g. "  KPHB    Metro   " -> "kphb metro"
 */
export function normalizePlace(place) {
  if (!place || typeof place !== 'string') return '';
  
  return place
    .toLowerCase()
    .normalize('NFKD')
    // Remove periods so acronyms like k.p.h.b. become kphb
    .replace(/\./g, '')
    // Replace common punctuation like commas, dashes, slashes with spaces
    .replace(/[,/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    // Collapse all whitespace sequences into a single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates an opaque, non-sensitive, human-readable reference ID for reporters.
 * Example: SFR-2026-A8K2F9
 */
export function generateReferenceId() {
  const year = new Date().getFullYear();
  const randomChars = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
  return `SFR-${year}-${randomChars}`;
}

/**
 * Generates a one-way safe SHA-256 hash of an IP address for abuse rate limiting
 * without storing personal IP addresses in plain text.
 */
export function hashIp(ip) {
  if (!ip) return 'unknown';
  const salt = process.env.SESSION_SECRET || 'safesignal_ip_salt';
  return crypto.createHmac('sha256', salt).update(ip).digest('hex').slice(0, 32);
}
