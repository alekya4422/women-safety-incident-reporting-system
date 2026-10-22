import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';
import { normalizePlace } from '../utils/normalizer.js';

/**
 * Resolves place to canonical name using place_mappings aliases if available.
 */
export async function getCanonicalPlace(rawPlace) {
  const normalized = normalizePlace(rawPlace);
  try {
    const mappings = await query('SELECT canonical_place FROM place_mappings WHERE raw_place = ?', [normalized]);
    if (mappings && mappings.length > 0) {
      return mappings[0].canonical_place;
    }
  } catch (err) {
    // ignore
  }
  return normalized;
}

/**
 * Fetches active threshold and window settings.
 */
export async function getAggregationSettings() {
  let threshold = 5;
  let windowHours = 24;

  try {
    const rows = await query('SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN (?, ?)', [
      'alert_threshold',
      'alert_window_hours'
    ]);

    rows.forEach((r) => {
      if (r.setting_key === 'alert_threshold') threshold = parseInt(r.setting_value, 10) || 5;
      if (r.setting_key === 'alert_window_hours') windowHours = parseInt(r.setting_value, 10) || 24;
    });
  } catch (err) {
    console.error('Error loading settings, using defaults:', err.message);
  }

  return { threshold, windowHours };
}

/**
 * Runs aggregation to detect clusters and sync alerts.
 * Aggregates reports by normalized place within the rolling window.
 */
export async function runClusterAggregation() {
  const { threshold, windowHours } = await getAggregationSettings();
  
  const windowStart = new Date(Date.now() - windowHours * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');

  // Query counts grouped by normalized place
  const clusters = await query(
    `SELECT place_normalized, COUNT(*) as report_count 
     FROM reports 
     WHERE incident_time >= ? AND status != 'closed'
     GROUP BY place_normalized`,
    [windowStart]
  );

  const existingAlerts = await query('SELECT * FROM alerts');
  const alertMap = new Map();
  existingAlerts.forEach((a) => alertMap.set(a.place_normalized, a));

  const generatedAlerts = [];

  for (const cluster of clusters) {
    const placeNorm = cluster.place_normalized;
    const count = parseInt(cluster.report_count, 10);
    const existing = alertMap.get(placeNorm);

    // Get a pretty display name from the most recent report at this place
    const recentReport = await query(
      'SELECT place_original FROM reports WHERE place_normalized = ? ORDER BY incident_time DESC LIMIT 1',
      [placeNorm]
    );
    const placeDisplay = (recentReport && recentReport[0] && recentReport[0].place_original) || placeNorm;

    if (count >= threshold) {
      if (existing) {
        // Update count snapshot while preserving acknowledgement state if within window
        await query(
          'UPDATE alerts SET report_count = ?, threshold = ?, window_hours = ?, updated_at = NOW() WHERE id = ?',
          [count, threshold, windowHours, existing.id]
        );
        generatedAlerts.push({ ...existing, report_count: count, threshold, window_hours: windowHours });
      } else {
        // Create new active alert
        const alertId = `alt_${uuidv4().slice(0, 12)}`;
        await query(
          `INSERT INTO alerts (id, place_normalized, place_display, report_count, threshold, window_hours, state, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'active', NOW())`,
          [alertId, placeNorm, placeDisplay, count, threshold, windowHours]
        );
        generatedAlerts.push({
          id: alertId,
          place_normalized: placeNorm,
          place_display: placeDisplay,
          report_count: count,
          threshold,
          window_hours: windowHours,
          state: 'active'
        });
      }
    } else if (existing && existing.state === 'active') {
      // If count dropped below threshold, we keep record but mark resolved or update count
      await query(
        'UPDATE alerts SET report_count = ?, updated_at = NOW() WHERE id = ?',
        [count, existing.id]
      );
    }
  }

  return { threshold, windowHours, activeClusters: generatedAlerts };
}

/**
 * Returns matching report count for a specific normalized place within the rolling window.
 */
export async function getPlaceReportCount(placeNormalized, windowHours = 24) {
  const windowStart = new Date(Date.now() - windowHours * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const rows = await query(
    `SELECT COUNT(*) as count FROM reports WHERE place_normalized = ? AND incident_time >= ? AND status != 'closed'`,
    [placeNormalized, windowStart]
  );
  return rows && rows[0] ? parseInt(rows[0].count, 10) : 0;
}
