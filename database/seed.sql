-- SafeSignal Seed Data
-- Seeds default settings, initial admin, responder contacts, and a 5-report sample cluster at KPHB Metro

-- Default Settings
INSERT INTO app_settings (setting_key, setting_value, description)
VALUES 
  ('alert_threshold', '5', 'Minimum reports in time window to trigger location alert'),
  ('alert_window_hours', '24', 'Rolling time window in hours for aggregation'),
  ('retention_days', '365', 'Data retention policy period in days')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Initial Administrator
-- Credentials: admin / Admin@SafeSignal2026!
INSERT INTO admin_users (id, username, email, password_hash, role, is_active)
VALUES 
  ('usr_admin_01', 'admin', 'admin@safesignal.local', '$2a$10$0zHylrpdxcJkxEbXAPCYju2hCmjSYok.6y/xhWk7afrvrdsWxiZ4y', 'superadmin', 1)
ON DUPLICATE KEY UPDATE username = VALUES(username);

-- Configured Responder Contacts (Deliberate Admin Action Contacts)
INSERT INTO responder_contacts (id, name, category, phone, instructions, is_active)
VALUES
  ('resp_01', 'Transit & Metro Safety Patrol', 'Transit Escort', '+91 40 2345 6789', 'Available 6:00 AM - 11:30 PM. Dispatch team covers metro concourse and bus interchange.', 1),
  ('resp_02', 'Community SafeWalk Volunteer Network', 'Community Watch', '+91 98765 43210', 'Community-led evening safe escort for women walking from transit stations to residential colonies.', 1),
  ('resp_03', 'District Women Support & Counseling Cell', 'Support Helpline', '+91 40 2765 4321', 'Confidential psychological, medical, and legal guidance for women survivors.', 1),
  ('resp_04', 'Campus Security Quick Team', 'Campus Security', '+91 40 2987 6543', 'Available 24/7 for collegiate zones and hostel roads.', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Seed Place Mappings (Alias to canonical)
INSERT INTO place_mappings (id, raw_place, canonical_place, created_by)
VALUES
  ('map_01', 'kphb colony metro', 'kphb metro', 'system'),
  ('map_02', 'kphb metro station', 'kphb metro', 'system'),
  ('map_03', 'cyber towers hitec', 'hitec city', 'system')
ON DUPLICATE KEY UPDATE canonical_place = VALUES(canonical_place);

-- Seed Reports: Cluster of 5 reports at 'KPHB Metro' within last 24h
INSERT INTO reports (id, reference_id, place_original, place_normalized, place_landmark, coordinates_approx, incident_time, incident_time_approx, category, description, status, reporter_contact, reporter_contact_note, created_at)
VALUES
  ('rep_kphb_01', 'SFR-2026-104921', 'KPHB Metro Station', 'kphb metro', 'Exit Gate B, near staircase', '17.4933,78.3995', NOW() - INTERVAL 3 HOUR, 0, 'harassment', 'Group of men loitering near the staircase making persistent catcalls and passing inappropriate remarks at commuters.', 'new', 'confidential-9876@safe.org', 'Provided optional phone for safe text follow-up only', NOW() - INTERVAL 3 HOUR),
  
  ('rep_kphb_02', 'SFR-2026-104922', 'KPHB Metro', 'kphb metro', 'Bus stop shelter below the metro bridge', '17.4931,78.3992', NOW() - INTERVAL 6 HOUR, 1, 'stalking', 'Followed from metro exit down to the bus stop by an unidentified person on a bike who kept circling slowly.', 'new', NULL, NULL, NOW() - INTERVAL 6 HOUR),
  
  ('rep_kphb_03', 'SFR-2026-104923', 'kphb metro', 'kphb metro', 'Poorly lit auto rickshaw stand corner', '17.4935,78.3998', NOW() - INTERVAL 11 HOUR, 0, 'unsafe_transport', 'Multiple auto drivers aggressively crowding passengers, refusing standard meters, and blocking pedestrians.', 'reviewing', NULL, NULL, NOW() - INTERVAL 11 HOUR),
  
  ('rep_kphb_04', 'SFR-2026-104924', 'KPHB Metro - Pillar 742', 'kphb metro', 'Pillar 742 service road', '17.4932,78.3994', NOW() - INTERVAL 18 HOUR, 0, 'suspicious_behavior', 'Broken streetlights along the service road, individual lurking in the shadows watching women commuters walking home.', 'new', 'contact@safecommunity.net', 'Requested contact if safety lighting petition is raised', NOW() - INTERVAL 18 HOUR),
  
  ('rep_kphb_05', 'SFR-2026-104925', 'KPHB Metro Station', 'kphb metro', 'Pedestrian foot overbridge walkway', '17.4934,78.3996', NOW() - INTERVAL 22 HOUR, 0, 'harassment', 'Verbal harassment and blocking path while crossing the pedestrian bridge after 9 PM.', 'new', NULL, NULL, NOW() - INTERVAL 22 HOUR),

  -- Out-of-window report at KPHB (36 hours ago) to verify window filtering
  ('rep_kphb_old', 'SFR-2026-104900', 'KPHB Metro', 'kphb metro', 'Under flyover', '17.4930,78.3990', NOW() - INTERVAL 36 HOUR, 0, 'harassment', 'Historic report outside the 24 hour rolling window for test verification.', 'closed', NULL, NULL, NOW() - INTERVAL 36 HOUR),

  -- Separate place reports (not in cluster threshold)
  ('rep_hitec_01', 'SFR-2026-104930', 'Hitec City Mindspace', 'hitec city', 'Rear gate near tech park', '17.4416,78.3809', NOW() - INTERVAL 4 HOUR, 0, 'suspicious_behavior', 'Single cab driver insisting on taking an unmapped dark alley detour, commuter felt unsafe and exited early.', 'new', NULL, NULL, NOW() - INTERVAL 4 HOUR),
  
  ('rep_gach_01', 'SFR-2026-104931', 'Gachibowli Stadium Road', 'gachibowli', 'Opposite DLF main gate', '17.4435,78.3582', NOW() - INTERVAL 14 HOUR, 0, 'unsafe_transport', 'Shared auto driver refused drop-off at designated stop and was aggressive when challenged.', 'reviewing', NULL, NULL, NOW() - INTERVAL 14 HOUR);

-- Pre-seed Initial Alert for KPHB Metro
INSERT INTO alerts (id, place_normalized, place_display, report_count, threshold, window_hours, state, created_at)
VALUES
  ('alt_kphb_01', 'kphb metro', 'KPHB Metro', 5, 5, 24, 'active', NOW() - INTERVAL 2 HOUR)
ON DUPLICATE KEY UPDATE report_count = VALUES(report_count);
