import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';
import { adminLoginSchema, reportStatusUpdateSchema, thresholdSettingsSchema, responderContactSchema, alertActionSchema } from '../schemas/index.js';
import { createSessionToken, SESSION_COOKIE_NAME } from '../middleware/auth.js';
import { runClusterAggregation, getPlaceReportCount, getAggregationSettings } from '../services/aggregationService.js';
import { logAuditEvent } from '../services/auditService.js';
import { getPrivateImageStream, generateImageAccessToken, verifyImageAccessToken, deletePrivateImage } from '../services/storageService.js';

/**
 * Admin Login
 */
export async function login(req, res) {
  try {
    const parse = adminLoginSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const username = parse.data.username.trim();
    const password = parse.data.password.trim();
    const users = await query('SELECT * FROM admin_users WHERE username = ? OR email = ?', [username, username]);

    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = users[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'This administrator account has been deactivated.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash) || (parse.data.password !== password && await bcrypt.compare(parse.data.password, user.password_hash));
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = createSessionToken(user);

    // Set HTTP-only secure cookie
    const isProd = process.env.NODE_ENV === 'production';
    const sameSiteSetting = process.env.COOKIE_SAME_SITE || (isProd ? 'none' : 'lax');
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd || process.env.COOKIE_SECURE === 'true' || sameSiteSetting === 'none',
      sameSite: sameSiteSetting,
      maxAge: 8 * 60 * 60 * 1000
    });

    await logAuditEvent({
      adminId: user.id,
      adminUsername: user.username,
      action: 'ADMIN_LOGIN',
      targetType: 'auth',
      targetId: user.id
    });

    return res.json({
      success: true,
      token, // Also return token for clients that prefer Bearer header
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('[Admin Login Error]:', err);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
}

/**
 * Admin Logout
 */
export async function logout(req, res) {
  if (req.admin) {
    await logAuditEvent({
      adminId: req.admin.id,
      adminUsername: req.admin.username,
      action: 'ADMIN_LOGOUT',
      targetType: 'auth',
      targetId: req.admin.id
    });
  }
  const isProd = process.env.NODE_ENV === 'production';
  const sameSiteSetting = process.env.COOKIE_SAME_SITE || (isProd ? 'none' : 'lax');
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd || process.env.COOKIE_SECURE === 'true' || sameSiteSetting === 'none',
    sameSite: sameSiteSetting
  });
  return res.json({ success: true, message: 'Logged out successfully' });
}

/**
 * Get current session profile
 */
export async function me(req, res) {
  return res.json({ user: req.admin });
}

/**
 * Dashboard Overview Statistics
 */
export async function getDashboardOverview(req, res) {
  try {
    const { threshold, windowHours } = await getAggregationSettings();
    const windowStart = new Date(Date.now() - windowHours * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    const [allReports, windowReports, awaitingReview, activeAlerts] = await Promise.all([
      query('SELECT COUNT(*) as count FROM reports'),
      query('SELECT COUNT(*) as count FROM reports WHERE incident_time >= ?', [windowStart]),
      query("SELECT COUNT(*) as count FROM reports WHERE status = 'new'"),
      query("SELECT * FROM alerts WHERE state IN ('active', 'acknowledged')")
    ]);

    const totalCount = allReports[0] ? parseInt(allReports[0].count, 10) : 0;
    const periodCount = windowReports[0] ? parseInt(windowReports[0].count, 10) : 0;
    const reviewCount = awaitingReview[0] ? parseInt(awaitingReview[0].count, 10) : 0;
    const alertLocationsCount = activeAlerts ? activeAlerts.length : 0;

    return res.json({
      overview: {
        totalReports: totalCount,
        periodReports: periodCount,
        reportsAwaitingReview: reviewCount,
        locationsAtThreshold: alertLocationsCount,
        windowHours,
        threshold
      },
      activeAlerts: activeAlerts || []
    });
  } catch (err) {
    console.error('[Dashboard Overview Error]:', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
}

/**
 * List Reports (with filtering, pagination, place cluster count)
 * Notice: Excludes raw reporter contact details and full images from the bulk list
 */
export async function listReports(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 15, 100);
    const offset = (page - 1) * limit;

    const { status, category, place, search, timeRange, alertOnly } = req.query;

    const conditions = [];
    const params = [];

    if (status && status !== 'all') {
      conditions.push('r.status = ?');
      params.push(status);
    }

    if (category && category !== 'all') {
      conditions.push('r.category = ?');
      params.push(category);
    }

    if (place) {
      conditions.push('r.place_normalized = ?');
      params.push(place.toLowerCase().trim());
    }

    if (timeRange && timeRange !== 'all') {
      const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : timeRange === '30d' ? 720 : 24;
      const since = new Date(Date.now() - hours * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      conditions.push('r.incident_time >= ?');
      params.push(since);
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      conditions.push('(LOWER(r.place_original) LIKE ? OR LOWER(r.description) LIKE ? OR r.reference_id LIKE ?)');
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Fetch reports
    const sql = `
      SELECT 
        r.id, r.reference_id, r.place_original, r.place_normalized, r.place_landmark,
        r.incident_time, r.incident_time_approx, r.category, r.status, r.created_at,
        LEFT(r.description, 140) as short_description,
        (r.reporter_contact IS NOT NULL) as has_contact
      FROM reports r
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const reports = await query(sql, [...params, limit, offset]);

    // Total count for pagination
    const countSql = `SELECT COUNT(*) as total FROM reports r ${whereClause}`;
    const countResult = await query(countSql, params);
    const total = countResult && countResult[0] ? parseInt(countResult[0].total, 10) : 0;

    // Attach rolling 24h count for each report's place
    const { windowHours, threshold } = await getAggregationSettings();
    const enriched = await Promise.all(
      reports.map(async (rep) => {
        const placeCount = await getPlaceReportCount(rep.place_normalized, windowHours);
        return {
          ...rep,
          place_window_count: placeCount,
          is_at_threshold: placeCount >= threshold
        };
      })
    );

    return res.json({
      reports: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('[List Reports Error]:', err);
    return res.status(500).json({ error: 'Failed to retrieve reports' });
  }
}

/**
 * Get Report Detail
 * Staff can view full description, images, and contact info under clear privacy boundary
 */
export async function getReportDetail(req, res) {
  try {
    const { id } = req.params;
    const reports = await query('SELECT * FROM reports WHERE id = ? OR reference_id = ?', [id, id]);

    if (!reports || reports.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reports[0];

    // Fetch attached images
    const images = await query('SELECT id, storage_key, original_filename, mime_type, file_size, created_at FROM report_images WHERE report_id = ? AND is_deleted = 0', [report.id]);

    // Attach short-lived authorized access token for each image
    const authorizedImages = images.map(img => ({
      id: img.id,
      original_filename: img.original_filename,
      file_size: img.file_size,
      mime_type: img.mime_type,
      view_url: `/api/admin/reports/${report.id}/images/${img.id}?token=${generateImageAccessToken(img.id, img.storage_key, req.admin.id)}`
    }));

    // Check cluster count
    const { windowHours, threshold } = await getAggregationSettings();
    const placeCount = await getPlaceReportCount(report.place_normalized, windowHours);

    // Audit log if contact details are viewed
    if (report.reporter_contact) {
      await logAuditEvent({
        adminId: req.admin.id,
        adminUsername: req.admin.username,
        action: 'VIEW_CONTACT_DETAILS',
        targetType: 'report',
        targetId: report.id,
        metadata: { reference_id: report.reference_id }
      });
    }

    return res.json({
      report: {
        ...report,
        place_window_count: placeCount,
        is_at_threshold: placeCount >= threshold,
        images: authorizedImages
      }
    });
  } catch (err) {
    console.error('[Report Detail Error]:', err);
    return res.status(500).json({ error: 'Failed to fetch report detail' });
  }
}

/**
 * Update Report Status
 */
export async function updateReportStatus(req, res) {
  try {
    const { id } = req.params;
    const parse = reportStatusUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid status update', details: parse.error.errors });
    }

    const { status, internal_note } = parse.data;

    const existing = await query('SELECT id, reference_id, status FROM reports WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const oldStatus = existing[0].status;

    await query('UPDATE reports SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);

    await logAuditEvent({
      adminId: req.admin.id,
      adminUsername: req.admin.username,
      action: 'UPDATE_REPORT_STATUS',
      targetType: 'report',
      targetId: id,
      metadata: { old_status: oldStatus, new_status: status, note: internal_note || null }
    });

    // Re-evaluate aggregation if status changed to/from closed
    runClusterAggregation().catch(() => {});

    return res.json({ success: true, message: `Report status updated to ${status}` });
  } catch (err) {
    console.error('[Update Status Error]:', err);
    return res.status(500).json({ error: 'Failed to update report status' });
  }
}

/**
 * Serve Private Image Stream
 * Only accessible to authenticated admins or with valid short-lived HMAC token
 */
export async function servePrivateImage(req, res) {
  try {
    const { reportId, imageId } = req.params;
    const { token } = req.query;

    let isAuthorized = false;
    if (req.admin) {
      isAuthorized = true;
    } else if (token) {
      const valid = verifyImageAccessToken(token, imageId);
      if (valid) isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized image access' });
    }

    const images = await query('SELECT * FROM report_images WHERE id = ? AND report_id = ? AND is_deleted = 0', [imageId, reportId]);
    if (!images || images.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const img = images[0];
    const stream = await getPrivateImageStream(img.storage_key);

    if (!stream) {
      return res.status(404).json({ error: 'Image file not found on disk' });
    }

    res.setHeader('Content-Type', img.mime_type);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    stream.pipe(res);
  } catch (err) {
    console.error('[Serve Image Error]:', err);
    return res.status(500).json({ error: 'Failed to stream private image' });
  }
}

/**
 * List Alerts
 */
export async function listAlerts(req, res) {
  try {
    // Run sync before listing
    await runClusterAggregation();
    const alerts = await query('SELECT * FROM alerts ORDER BY created_at DESC');
    return res.json({ alerts: alerts || [] });
  } catch (err) {
    console.error('[List Alerts Error]:', err);
    return res.status(500).json({ error: 'Failed to fetch alerts' });
  }
}

/**
 * Update Alert State (Acknowledge / Resolve)
 */
export async function updateAlertState(req, res) {
  try {
    const { id } = req.params;
    const parse = alertActionSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid alert action', details: parse.error.errors });
    }

    const { action, note } = parse.data;
    const newState = action === 'resolve' ? 'resolved' : 'acknowledged';

    await query(
      'UPDATE alerts SET state = ?, acknowledged_by = ?, acknowledged_at = NOW(), updated_at = NOW() WHERE id = ?',
      [newState, req.admin.username, id]
    );

    await logAuditEvent({
      adminId: req.admin.id,
      adminUsername: req.admin.username,
      action: action === 'resolve' ? 'RESOLVE_ALERT' : 'ACKNOWLEDGE_ALERT',
      targetType: 'alert',
      targetId: id,
      metadata: { state: newState, note: note || null }
    });

    return res.json({ success: true, message: `Alert marked as ${newState}` });
  } catch (err) {
    console.error('[Alert Update Error]:', err);
    return res.status(500).json({ error: 'Failed to update alert state' });
  }
}

/**
 * Threshold and window settings
 */
export async function getSettings(req, res) {
  try {
    const settings = await query('SELECT * FROM app_settings');
    const config = {};
    settings.forEach(s => {
      config[s.setting_key] = isNaN(s.setting_value) ? s.setting_value : Number(s.setting_value);
    });
    return res.json({ settings: config });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load settings' });
  }
}

export async function updateSettings(req, res) {
  try {
    const parse = thresholdSettingsSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid settings configuration', details: parse.error.errors });
    }

    const { threshold, window_hours, retention_days } = parse.data;

    await query(
      'UPDATE app_settings SET setting_value = ?, updated_by = ? WHERE setting_key = ?',
      [String(threshold), req.admin.username, 'alert_threshold']
    );
    await query(
      'UPDATE app_settings SET setting_value = ?, updated_by = ? WHERE setting_key = ?',
      [String(window_hours), req.admin.username, 'alert_window_hours']
    );
    if (retention_days) {
      await query(
        'UPDATE app_settings SET setting_value = ?, updated_by = ? WHERE setting_key = ?',
        [String(retention_days), req.admin.username, 'retention_days']
      );
    }

    await logAuditEvent({
      adminId: req.admin.id,
      adminUsername: req.admin.username,
      action: 'UPDATE_THRESHOLD_SETTINGS',
      targetType: 'setting',
      targetId: 'alert_threshold',
      metadata: { threshold, window_hours, retention_days }
    });

    // Re-run aggregation with new settings immediately
    await runClusterAggregation();

    return res.json({ success: true, message: 'Settings saved and alert clusters recalculated.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update settings' });
  }
}

/**
 * Responder Contacts Management
 */
export async function listResponderContacts(req, res) {
  try {
    const contacts = await query('SELECT * FROM responder_contacts ORDER BY created_at ASC');
    return res.json({ contacts });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list responder contacts' });
  }
}

export async function createOrUpdateContact(req, res) {
  try {
    const parse = responderContactSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid contact details', details: parse.error.errors });
    }

    const { name, category, phone, instructions, is_active } = parse.data;
    const { id } = req.params;

    if (id && id !== 'new') {
      await query(
        'UPDATE responder_contacts SET name = ?, category = ?, phone = ?, instructions = ?, is_active = ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
        [name, category, phone, instructions || null, is_active ? 1 : 0, req.admin.username, id]
      );
      await logAuditEvent({
        adminId: req.admin.id,
        adminUsername: req.admin.username,
        action: 'UPDATE_RESPONDER_CONTACT',
        targetType: 'contact',
        targetId: id,
        metadata: { name, category }
      });
      return res.json({ success: true, message: 'Contact updated successfully' });
    } else {
      const newId = `resp_${uuidv4().slice(0, 10)}`;
      await query(
        'INSERT INTO responder_contacts (id, name, category, phone, instructions, is_active, updated_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
        [newId, name, category, phone, instructions || null, is_active ? 1 : 0, req.admin.username]
      );
      await logAuditEvent({
        adminId: req.admin.id,
        adminUsername: req.admin.username,
        action: 'CREATE_RESPONDER_CONTACT',
        targetType: 'contact',
        targetId: newId,
        metadata: { name, category }
      });
      return res.status(201).json({ success: true, id: newId, message: 'Contact created successfully' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save responder contact' });
  }
}

/**
 * Log Responder Contact Action
 * Specification: "Opening the action must show the configured contact name and number and require a deliberate click to proceed.
 * Add a confirmation step before opening the phone link and log the admin action without logging unnecessary sensitive information."
 */
export async function logResponderAction(req, res) {
  try {
    const { contactId, placeNormalized, reportId } = req.body;
    const contacts = await query('SELECT name, category FROM responder_contacts WHERE id = ?', [contactId]);
    const contactName = contacts && contacts[0] ? contacts[0].name : 'Unknown Contact';

    await logAuditEvent({
      adminId: req.admin.id,
      adminUsername: req.admin.username,
      action: 'DELIBERATE_RESPONDER_ACTION_INITIATED',
      targetType: 'responder',
      targetId: contactId,
      metadata: {
        contact_name: contactName,
        place_normalized: placeNormalized || null,
        report_id: reportId || null,
        notice: 'Admin explicitly confirmed intent to contact responder. Device phone link / dial instructions displayed.'
      }
    });

    return res.json({ success: true, message: 'Action logged for audit compliance' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to record responder action audit' });
  }
}

/**
 * List Audit Logs
 */
export async function listAuditLogs(req, res) {
  try {
    const logs = await query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100');
    return res.json({ logs: logs || [] });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch audit records' });
  }
}
