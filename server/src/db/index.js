import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

let pool = null;
let useFallback = false;
let fallbackStore = {
  admin_users: [],
  reports: [],
  report_images: [],
  place_mappings: [],
  alerts: [],
  responder_contacts: [],
  audit_logs: [],
  app_settings: []
};

import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../../');
const FALLBACK_FILE = path.resolve(ROOT_DIR, 'storage/safesignal_dev_db.json');

// Default bcrypt hash for 'Admin@SafeSignal2026!'
const DEFAULT_ADMIN_HASH = '$2a$10$0zHylrpdxcJkxEbXAPCYju2hCmjSYok.6y/xhWk7afrvrdsWxiZ4y';

// Helper to save/load fallback store
function saveFallback() {
  try {
    const dir = path.dirname(FALLBACK_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(fallbackStore, null, 2));
  } catch (err) {
    // ignore
  }
}

function loadFallback() {
  try {
    if (fs.existsSync(FALLBACK_FILE)) {
      const data = JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf-8'));
      fallbackStore = { ...fallbackStore, ...data };
    }
  } catch (err) {
    // ignore
  }

  // Ensure initial admin user is ALWAYS present so login never fails
  if (!fallbackStore.admin_users || fallbackStore.admin_users.length === 0) {
    fallbackStore.admin_users = [{
      id: 'usr_admin_01',
      username: 'admin',
      email: 'admin@safesignal.local',
      password_hash: DEFAULT_ADMIN_HASH,
      role: 'superadmin',
      is_active: 1,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
    }];
    saveFallback();
  }
}

/**
 * Initializes database connection pool.
 */
export async function initDb() {
  if (pool) return pool;

  loadFallback();

  try {
    const sslConfig = (process.env.DB_SSL === 'true' || process.env.DB_SSL === '1')
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : undefined;

    const candidatePool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'safesignal_user',
      password: process.env.DB_PASSWORD || 'safesignal_password',
      database: process.env.DB_NAME || 'safesignal',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 5000,
      ssl: sslConfig
    });

    const connection = await candidatePool.getConnection();
    await connection.ping();
    connection.release();

    pool = candidatePool;
    useFallback = false;
    console.log('[DB] Connected successfully to MySQL database on ' + (process.env.DB_HOST || '127.0.0.1'));
    return pool;
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[CRITICAL] MySQL connection failed in production:', err.message);
      throw new Error(`Failed to connect to production MySQL database (${err.message}). Verify DB credentials and DB_SSL.`);
    }
    console.warn('[DB] MySQL connection not available (' + err.message + '). Activating resilient local dev/test data engine.');
    useFallback = true;
    return null;
  }
}

/**
 * Primary query function executing parameterized queries.
 */
export async function query(sql, params = []) {
  if (pool === null && !useFallback) {
    await initDb();
  }

  if (!useFallback && pool) {
    try {
      const [rows] = await pool.query(sql, params);
      return rows;
    } catch (err) {
      throw err;
    }
  }

  // Fallback in-memory/file SQL engine for environments without active MySQL daemon
  return executeFallbackQuery(sql, params);
}

/**
 * Executes queries against the resilient in-memory/JSON store when MySQL is not running.
 */
function executeFallbackQuery(sql, params = []) {
  const cleanSql = sql.trim().replace(/\s+/g, ' ');
  const upper = cleanSql.toUpperCase();

  // Handle INSERT
  if (upper.startsWith('INSERT INTO')) {
    const tableMatch = cleanSql.match(/INSERT INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES/i);
    if (tableMatch) {
      const table = tableMatch[1].toLowerCase();
      const columns = tableMatch[2].split(',').map(c => c.trim().replace(/[`]/g, ''));
      
      const record = {};
      columns.forEach((col, idx) => {
        let val = params[idx];
        if (val === undefined) {
          if (col === 'created_at' || col === 'updated_at') val = new Date().toISOString().slice(0, 19).replace('T', ' ');
          else if (col === 'status') val = 'new';
          else if (col === 'is_active') val = 1;
        }
        record[col] = val;
      });

      if (!record.created_at) record.created_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
      if (!record.updated_at) record.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

      if (fallbackStore[table]) {
        const idCol = columns[0];
        const existingIdx = fallbackStore[table].findIndex(item => item[idCol] === record[idCol]);
        if (existingIdx >= 0) {
          fallbackStore[table][existingIdx] = { ...fallbackStore[table][existingIdx], ...record, updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ') };
        } else {
          fallbackStore[table].push(record);
        }
        saveFallback();
      }
      return { affectedRows: 1, insertId: record.id || 1 };
    }
  }

  // Handle UPDATE
  if (upper.startsWith('UPDATE')) {
    const tableMatch = cleanSql.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);
    if (tableMatch) {
      const table = tableMatch[1].toLowerCase();
      const whereClause = tableMatch[3] || '';
      
      if (fallbackStore[table]) {
        let affected = 0;
        fallbackStore[table].forEach(item => {
          let match = true;
          if (whereClause.includes('id = ?')) {
            const idVal = params[params.length - 1];
            if (item.id !== idVal) match = false;
          } else if (whereClause.includes('setting_key = ?')) {
            const keyVal = params[params.length - 1];
            if (item.setting_key !== keyVal) match = false;
          }
          if (match) {
            if (table === 'reports' && cleanSql.includes('status = ?')) {
              item.status = params[0];
              item.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
            }
            if (table === 'alerts') {
              if (cleanSql.includes('report_count = ?')) {
                item.report_count = params[0];
                item.threshold = params[1];
                item.window_hours = params[2];
              }
              if (cleanSql.includes('state = ?')) item.state = params[0];
              if (cleanSql.includes('acknowledged_by = ?')) item.acknowledged_by = params[1];
              if (cleanSql.includes('acknowledged_at = NOW()')) item.acknowledged_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
            }
            if (table === 'app_settings' && cleanSql.includes('setting_value = ?')) {
              item.setting_value = String(params[0]);
              if (params[1]) item.updated_by = params[1];
            }
            if (table === 'responder_contacts') {
              if (params.length >= 4) {
                item.name = params[0];
                item.category = params[1];
                item.phone = params[2];
                item.instructions = params[3];
                item.is_active = params[4] !== undefined ? params[4] : item.is_active;
              }
            }
            affected++;
          }
        });
        saveFallback();
        return { affectedRows: affected };
      }
    }
  }

  // Handle DELETE
  if (upper.startsWith('DELETE FROM')) {
    const tableMatch = cleanSql.match(/DELETE FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+))?/i);
    if (tableMatch) {
      const table = tableMatch[1].toLowerCase();
      if (fallbackStore[table]) {
        const idVal = params[0];
        const before = fallbackStore[table].length;
        fallbackStore[table] = fallbackStore[table].filter(item => item.id !== idVal);
        saveFallback();
        return { affectedRows: before - fallbackStore[table].length };
      }
    }
  }

  // Handle SELECT
  if (upper.startsWith('SELECT')) {
    // 1. SELECT * FROM app_settings
    if (upper.includes('FROM APP_SETTINGS')) {
      if (cleanSql.includes('WHERE setting_key IN (?, ?)')) {
        return fallbackStore.app_settings.filter(s => params.includes(s.setting_key));
      }
      return [...fallbackStore.app_settings];
    }
    // 2. SELECT * FROM admin_users
    if (upper.includes('FROM ADMIN_USERS')) {
      if (cleanSql.includes('WHERE username = ? OR email = ?')) {
        const userOrEmail = String(params[0] || '').toLowerCase().trim();
        return fallbackStore.admin_users.filter(u => 
          (u.username && u.username.toLowerCase().trim() === userOrEmail) || 
          (u.email && u.email.toLowerCase().trim() === userOrEmail)
        );
      }
      if (cleanSql.includes('WHERE id = ?')) {
        return fallbackStore.admin_users.filter(u => u.id === params[0]);
      }
      return [...fallbackStore.admin_users];
    }
    // 3. SELECT FROM responder_contacts
    if (upper.includes('FROM RESPONDER_CONTACTS')) {
      if (cleanSql.includes('WHERE id = ?')) {
        return fallbackStore.responder_contacts.filter(c => c.id === params[0]);
      }
      if (cleanSql.includes('WHERE is_active = 1')) {
        return fallbackStore.responder_contacts.filter(c => Number(c.is_active) === 1);
      }
      return [...fallbackStore.responder_contacts];
    }
    // 4. SELECT FROM place_mappings
    if (upper.includes('FROM PLACE_MAPPINGS')) {
      if (cleanSql.includes('WHERE raw_place = ?')) {
        return fallbackStore.place_mappings.filter(m => m.raw_place === params[0]);
      }
      return [...fallbackStore.place_mappings];
    }
    // 5. SELECT FROM alerts
    if (upper.includes('FROM ALERTS')) {
      let list = [...fallbackStore.alerts];
      if (cleanSql.includes('WHERE place_normalized = ?')) {
        list = list.filter(a => a.place_normalized === params[0]);
      }
      if (cleanSql.includes("state IN ('active', 'acknowledged')")) {
        list = list.filter(a => ['active', 'acknowledged'].includes(a.state));
      } else if (cleanSql.includes('state = ?')) {
        const stateParam = params.find(p => ['active', 'acknowledged', 'resolved'].includes(p));
        if (stateParam) list = list.filter(a => a.state === stateParam);
      }
      return list;
    }
    // 6. SELECT FROM report_images
    if (upper.includes('FROM REPORT_IMAGES')) {
      if (cleanSql.includes('WHERE report_id = ?')) {
        return fallbackStore.report_images.filter(img => img.report_id === params[0] && !img.is_deleted);
      }
      if (cleanSql.includes('WHERE id = ?')) {
        return fallbackStore.report_images.filter(img => img.id === params[0]);
      }
      return [...fallbackStore.report_images];
    }
    // 7. SELECT FROM audit_logs
    if (upper.includes('FROM AUDIT_LOGS')) {
      const sorted = [...fallbackStore.audit_logs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return sorted.slice(0, 100);
    }
    // 8. SELECT FROM reports
    if (upper.includes('FROM REPORTS')) {
      let list = [...fallbackStore.reports];

      // Single report by id or reference_id
      if (cleanSql.includes('WHERE r.id = ?') || cleanSql.includes('WHERE id = ?') || cleanSql.includes('WHERE id = ? OR reference_id = ?')) {
        return list.filter(r => r.id === params[0] || r.reference_id === params[0]);
      }
      if (cleanSql.includes('WHERE reference_id = ?')) {
        return list.filter(r => r.reference_id === params[0]);
      }

      // Group by aggregation query:
      // SELECT place_normalized, COUNT(*) as report_count FROM reports WHERE incident_time >= ? AND status != 'closed' GROUP BY place_normalized
      if (upper.includes('COUNT(*)') && upper.includes('GROUP BY PLACE_NORMALIZED')) {
        const since = params[0];
        const counts = {};
        list.forEach(r => {
          if (new Date(r.incident_time) >= new Date(since) && r.status !== 'closed') {
            counts[r.place_normalized] = (counts[r.place_normalized] || 0) + 1;
          }
        });
        return Object.entries(counts).map(([place_normalized, count]) => ({
          place_normalized,
          report_count: count
        }));
      }

      // Single place original fetch
      if (cleanSql.includes('SELECT place_original FROM reports WHERE place_normalized = ?')) {
        const matching = list.filter(r => r.place_normalized === params[0]);
        return matching.length > 0 ? [{ place_original: matching[matching.length - 1].place_original }] : [];
      }

      // Filter by conditions
      if (cleanSql.includes('place_normalized = ?')) {
        const placeVal = params.find(p => typeof p === 'string' && p.length > 0 && !p.startsWith('%') && !p.includes(':'));
        if (placeVal) list = list.filter(r => r.place_normalized === placeVal);
      }
      if (cleanSql.includes('category = ?')) {
        const catVal = params.find(p => ['harassment', 'stalking', 'unsafe_transport', 'assault', 'suspicious_behavior', 'other'].includes(p));
        if (catVal) list = list.filter(r => r.category === catVal);
      }
      if (cleanSql.includes("status = 'new'")) {
        list = list.filter(r => r.status === 'new');
      } else if (cleanSql.includes('status = ?')) {
        const statusVal = params.find(p => ['new', 'reviewing', 'referred', 'closed'].includes(p));
        if (statusVal) list = list.filter(r => r.status === statusVal);
      }
      if (cleanSql.includes("status != 'closed'")) {
        list = list.filter(r => r.status !== 'closed');
      }
      if (cleanSql.includes('incident_time >= ?')) {
        const timeParam = params.find(p => typeof p === 'string' && p.includes(':'));
        if (timeParam) {
          list = list.filter(r => new Date(r.incident_time) >= new Date(timeParam));
        }
      }

      // COUNT(*) query
      if (upper.includes('COUNT(*) AS TOTAL')) {
        return [{ total: list.length }];
      }
      if (upper.includes('COUNT(*) AS COUNT') || upper.includes('COUNT(*)')) {
        return [{ count: list.length }];
      }

      // Sort
      list.sort((a, b) => new Date(b.created_at || b.incident_time) - new Date(a.created_at || a.incident_time));

      // Pagination
      const limit = typeof params[params.length - 2] === 'number' ? params[params.length - 2] : 50;
      const offset = typeof params[params.length - 1] === 'number' ? params[params.length - 1] : 0;
      return list.slice(offset, offset + limit);
    }
  }

  return [];
}

export function getFallbackStore() {
  return fallbackStore;
}

export function resetFallbackStore() {
  fallbackStore = {
    admin_users: [],
    reports: [],
    report_images: [],
    place_mappings: [],
    alerts: [],
    responder_contacts: [],
    audit_logs: [],
    app_settings: []
  };
  saveFallback();
}
