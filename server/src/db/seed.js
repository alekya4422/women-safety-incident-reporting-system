import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { getFallbackStore } from './index.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../../');
const SEED_FILE = path.resolve(ROOT_DIR, 'database/seed.sql');
const FALLBACK_FILE = path.resolve(ROOT_DIR, 'storage/safesignal_dev_db.json');

async function runSeed() {
  console.log('--- Running SafeSignal Database Seed ---');
  
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'safesignal_user';
  const password = process.env.DB_PASSWORD || 'safesignal_password';
  const database = process.env.DB_NAME || 'safesignal';

  const adminPasswordHash = bcrypt.hashSync('Admin@SafeSignal2026!', 10);

  // 1. Try MySQL connection
  try {
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      multipleStatements: true
    });

    console.log(`[Seed] Connected to MySQL database '${database}'. Executing seed SQL...`);
    const seedSql = fs.readFileSync(SEED_FILE, 'utf-8');
    await connection.query(seedSql);
    console.log('[Seed] MySQL Seed executed successfully.');
    await connection.end();
  } catch (err) {
    console.warn(`[Seed] MySQL not active (${err.message}). Populating local development store...`);
  }

  // 2. Also populate / refresh the local JSON fallback store so local dev without MySQL works out-of-the-box
  try {
    const now = new Date();
    const hoursAgo = (h) => new Date(now.getTime() - h * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    const seedData = {
      app_settings: [
        { setting_key: 'alert_threshold', setting_value: '5', description: 'Reports threshold to trigger alert' },
        { setting_key: 'alert_window_hours', setting_value: '24', description: 'Rolling time window in hours' },
        { setting_key: 'retention_days', setting_value: '365', description: 'Data retention policy period in days' }
      ],
      admin_users: [
        {
          id: 'usr_admin_01',
          username: 'admin',
          email: 'admin@safesignal.local',
          password_hash: adminPasswordHash,
          role: 'superadmin',
          is_active: 1,
          created_at: hoursAgo(200)
        }
      ],
      responder_contacts: [
        {
          id: 'resp_01',
          name: 'Transit & Metro Safety Patrol',
          category: 'Transit Escort',
          phone: '+91 40 2345 6789',
          instructions: 'Available 6:00 AM - 11:30 PM. Dispatch team covers metro concourse and bus interchange.',
          is_active: 1
        },
        {
          id: 'resp_02',
          name: 'Community SafeWalk Volunteer Network',
          category: 'Community Watch',
          phone: '+91 98765 43210',
          instructions: 'Community-led evening safe escort for women walking from transit stations to residential colonies.',
          is_active: 1
        },
        {
          id: 'resp_03',
          name: 'District Women Support & Counseling Cell',
          category: 'Support Helpline',
          phone: '+91 40 2765 4321',
          instructions: 'Confidential psychological, medical, and legal guidance for women survivors.',
          is_active: 1
        },
        {
          id: 'resp_04',
          name: 'Campus Security Quick Team',
          category: 'Campus Security',
          phone: '+91 40 2987 6543',
          instructions: 'Available 24/7 for collegiate zones and hostel roads.',
          is_active: 1
        }
      ],
      place_mappings: [
        { id: 'map_01', raw_place: 'kphb colony metro', canonical_place: 'kphb metro', created_by: 'system' },
        { id: 'map_02', raw_place: 'kphb metro station', canonical_place: 'kphb metro', created_by: 'system' },
        { id: 'map_03', raw_place: 'cyber towers hitec', canonical_place: 'hitec city', created_by: 'system' }
      ],
      reports: [
        {
          id: 'rep_kphb_01',
          reference_id: 'SFR-2026-104921',
          place_original: 'KPHB Metro Station',
          place_normalized: 'kphb metro',
          place_landmark: 'Exit Gate B, near staircase',
          coordinates_approx: '17.4933,78.3995',
          incident_time: hoursAgo(3),
          incident_time_approx: 0,
          category: 'harassment',
          description: 'Group of men loitering near the staircase making persistent catcalls and passing inappropriate remarks at commuters.',
          status: 'new',
          reporter_contact: 'confidential-user@safe.org',
          reporter_contact_note: 'Provided optional email for safe follow-up only',
          created_at: hoursAgo(3)
        },
        {
          id: 'rep_kphb_02',
          reference_id: 'SFR-2026-104922',
          place_original: 'KPHB Metro',
          place_normalized: 'kphb metro',
          place_landmark: 'Bus stop shelter below the metro bridge',
          coordinates_approx: '17.4931,78.3992',
          incident_time: hoursAgo(6),
          incident_time_approx: 1,
          category: 'stalking',
          description: 'Followed from metro exit down to the bus stop by an unidentified person on a bike who kept circling slowly.',
          status: 'new',
          reporter_contact: null,
          reporter_contact_note: null,
          created_at: hoursAgo(6)
        },
        {
          id: 'rep_kphb_03',
          reference_id: 'SFR-2026-104923',
          place_original: 'kphb metro',
          place_normalized: 'kphb metro',
          place_landmark: 'Poorly lit auto rickshaw stand corner',
          coordinates_approx: '17.4935,78.3998',
          incident_time: hoursAgo(11),
          incident_time_approx: 0,
          category: 'unsafe_transport',
          description: 'Multiple auto drivers aggressively crowding passengers, refusing standard meters, and blocking pedestrians.',
          status: 'reviewing',
          reporter_contact: null,
          reporter_contact_note: null,
          created_at: hoursAgo(11)
        },
        {
          id: 'rep_kphb_04',
          reference_id: 'SFR-2026-104924',
          place_original: 'KPHB Metro - Pillar 742',
          place_normalized: 'kphb metro',
          place_landmark: 'Pillar 742 service road',
          coordinates_approx: '17.4932,78.3994',
          incident_time: hoursAgo(18),
          incident_time_approx: 0,
          category: 'suspicious_behavior',
          description: 'Broken streetlights along the service road, individual lurking in the shadows watching women commuters walking home.',
          status: 'new',
          reporter_contact: 'contact@safecommunity.net',
          reporter_contact_note: 'Requested contact if safety lighting petition is raised',
          created_at: hoursAgo(18)
        },
        {
          id: 'rep_kphb_05',
          reference_id: 'SFR-2026-104925',
          place_original: 'KPHB Metro Station',
          place_normalized: 'kphb metro',
          place_landmark: 'Pedestrian foot overbridge walkway',
          coordinates_approx: '17.4934,78.3996',
          incident_time: hoursAgo(22),
          incident_time_approx: 0,
          category: 'harassment',
          description: 'Verbal harassment and blocking path while crossing the pedestrian bridge after 9 PM.',
          status: 'new',
          reporter_contact: null,
          reporter_contact_note: null,
          created_at: hoursAgo(22)
        },
        {
          id: 'rep_kphb_old',
          reference_id: 'SFR-2026-104900',
          place_original: 'KPHB Metro',
          place_normalized: 'kphb metro',
          place_landmark: 'Under flyover',
          coordinates_approx: '17.4930,78.3990',
          incident_time: hoursAgo(36),
          incident_time_approx: 0,
          category: 'harassment',
          description: 'Historic report outside the 24 hour rolling window for test verification.',
          status: 'reviewing',
          reporter_contact: null,
          reporter_contact_note: null,
          created_at: hoursAgo(36)
        },
        {
          id: 'rep_hitec_01',
          reference_id: 'SFR-2026-104930',
          place_original: 'Hitec City Mindspace',
          place_normalized: 'hitec city',
          place_landmark: 'Rear gate near tech park',
          coordinates_approx: '17.4416,78.3809',
          incident_time: hoursAgo(4),
          incident_time_approx: 0,
          category: 'suspicious_behavior',
          description: 'Single cab driver insisting on taking an unmapped dark alley detour, commuter felt unsafe and exited early.',
          status: 'new',
          reporter_contact: null,
          reporter_contact_note: null,
          created_at: hoursAgo(4)
        },
        {
          id: 'rep_gach_01',
          reference_id: 'SFR-2026-104931',
          place_original: 'Gachibowli Stadium Road',
          place_normalized: 'gachibowli',
          place_landmark: 'Opposite DLF main gate',
          coordinates_approx: '17.4435,78.3582',
          incident_time: hoursAgo(14),
          incident_time_approx: 0,
          category: 'unsafe_transport',
          description: 'Shared auto driver refused drop-off at designated stop and was aggressive when challenged.',
          status: 'reviewing',
          reporter_contact: null,
          reporter_contact_note: null,
          created_at: hoursAgo(14)
        }
      ],
      report_images: [],
      alerts: [
        {
          id: 'alt_kphb_01',
          place_normalized: 'kphb metro',
          place_display: 'KPHB Metro',
          report_count: 5,
          threshold: 5,
          window_hours: 24,
          state: 'active',
          acknowledged_by: null,
          acknowledged_at: null,
          created_at: hoursAgo(2),
          updated_at: hoursAgo(2)
        }
      ],
      audit_logs: [
        {
          id: 'log_01',
          admin_id: 'usr_admin_01',
          admin_username: 'admin',
          action: 'SYSTEM_SEED',
          target_type: 'system',
          target_id: 'seed_init',
          metadata: JSON.stringify({ message: 'Initial sample data seeded' }),
          created_at: hoursAgo(2)
        }
      ]
    };

    const dir = path.dirname(FALLBACK_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(seedData, null, 2));
    console.log('[Seed] Local fallback database seeded with 5-report KPHB Metro cluster & admin account.');
  } catch (err) {
    console.error('[Seed] Error writing local fallback seed:', err);
  }

  console.log('--- Seed Process Finished ---');
  console.log('Default Admin Account:');
  console.log('Username: admin');
  console.log('Password: Admin@SafeSignal2026!');
}

runSeed();
