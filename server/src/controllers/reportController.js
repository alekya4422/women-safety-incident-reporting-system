import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';
import { reportSubmissionSchema } from '../schemas/index.js';
import { normalizePlace, generateReferenceId, hashIp } from '../utils/normalizer.js';
import { getCanonicalPlace, runClusterAggregation } from '../services/aggregationService.js';
import { savePrivateImage } from '../services/storageService.js';

export async function submitReport(req, res) {
  try {
    // 1. Validate request body with Zod
    const validationResult = reportSubmissionSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }

    const data = validationResult.data;

    // 2. Normalize place name and check alias mapping
    const rawPlace = data.place_original;
    const normalizedPlace = await getCanonicalPlace(rawPlace);

    // 3. Generate opaque identifiers
    const reportId = `rep_${uuidv4().slice(0, 16)}`;
    const referenceId = generateReferenceId();
    const reporterIpHash = hashIp(req.ip || req.connection.remoteAddress);

    // 4. Insert report record into MySQL
    await query(
      `INSERT INTO reports (
        id, reference_id, place_original, place_normalized, place_landmark,
        coordinates_approx, incident_time, incident_time_approx, category,
        description, status, reporter_contact, reporter_contact_note,
        reporter_ip_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, NOW())`,
      [
        reportId,
        referenceId,
        data.place_original,
        normalizedPlace,
        data.place_landmark || null,
        data.coordinates_approx || null,
        new Date(data.incident_time).toISOString().slice(0, 19).replace('T', ' '),
        data.incident_time_approx ? 1 : 0,
        data.category,
        data.description,
        data.reporter_contact || null,
        data.reporter_contact_note || null,
        reporterIpHash
      ]
    );

    // 5. Process optional uploaded images
    const savedImages = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const stored = await savePrivateImage(file.buffer, file.originalname);
          const imageId = `img_${uuidv4().slice(0, 16)}`;
          await query(
            `INSERT INTO report_images (id, report_id, storage_key, original_filename, mime_type, file_size, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [imageId, reportId, stored.storageKey, stored.originalFilename, stored.mimeType, stored.fileSize]
          );
          savedImages.push(imageId);
        } catch (imgErr) {
          console.warn('[Report Upload] Image upload rejected:', imgErr.message);
        }
      }
    }

    // 6. Trigger cluster aggregation asynchronously in background
    runClusterAggregation().catch(err => {
      console.error('[Aggregation] Background aggregation check failed:', err.message);
    });

    // 7. Return safe, reassuring confirmation to reporter
    // NEVER expose reporter identity, database internal ID, or other reports
    return res.status(201).json({
      success: true,
      referenceId,
      message: 'Your report has been securely and confidentially received.',
      submittedAt: new Date().toISOString(),
      guidance: 'SafeSignal is a reporting and community coordination platform. If you are in immediate physical danger, please contact your local emergency service immediately.'
    });
  } catch (err) {
    console.error('[Report Submission Error]:', err);
    return res.status(500).json({
      error: 'An unexpected error occurred while processing your report. Please try again in a few moments.'
    });
  }
}

/**
 * Provides suggested recognizable public localities (safe suggestions without disclosing report numbers)
 */
export async function getPublicSuggestions(req, res) {
  const suggestions = [
    'KPHB Metro',
    'Hitec City',
    'Gachibowli',
    'Ameerpet Metro',
    'Secunderabad Railway Station',
    'Madhapur Metro',
    'Banjara Hills Road 12',
    'Jubilee Hills Checkpost',
    'Dilsukhnagar Bus Depot',
    'Mehdipatnam Bus Terminal',
    'Kondapur Junction',
    'Kukatpally Y Junction'
  ];
  return res.json({ suggestions });
}

/**
 * Returns privacy and safety disclaimer parameters for the public form
 */
export async function getPublicNotice(req, res) {
  return res.json({
    appName: 'SafeSignal',
    emergencyDisclaimer: 'SafeSignal is an incident reporting and community safety coordination tool, not an emergency response dispatch service. Submitting a report does NOT dispatch police or emergency workers. If you are in immediate danger, call your local emergency helpline immediately.',
    privacyNotice: 'Reports are stored securely and only accessible by authorized safety administrators. Photos are stripped of EXIF/GPS metadata and kept in private encrypted storage. Contact information is strictly optional and never shared publicly.'
  });
}
