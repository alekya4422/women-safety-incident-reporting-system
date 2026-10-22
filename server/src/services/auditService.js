import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';

/**
 * Creates an immutable audit log record for administrative actions.
 * Never logs raw passwords, contact phone numbers, or full sensitive descriptions.
 */
export async function logAuditEvent({ adminId, adminUsername, action, targetType, targetId = null, metadata = {} }) {
  try {
    const logId = `aud_${uuidv4().slice(0, 12)}`;
    // Sanitize metadata to exclude PII
    const safeMeta = { ...metadata };
    delete safeMeta.password;
    delete safeMeta.password_hash;
    delete safeMeta.reporter_contact;
    delete safeMeta.phone;

    await query(
      `INSERT INTO audit_logs (id, admin_id, admin_username, action, target_type, target_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [logId, adminId, adminUsername, action, targetType, targetId, JSON.stringify(safeMeta)]
    );
    return logId;
  } catch (err) {
    console.error('[AuditLog] Failed to record audit log:', err.message);
    return null;
  }
}
