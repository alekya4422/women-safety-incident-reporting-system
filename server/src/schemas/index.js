import { z } from 'zod';

export const reportSubmissionSchema = z.object({
  place_original: z.string().trim().min(2, 'Place name must be at least 2 characters').max(255, 'Place name too long'),
  place_landmark: z.string().trim().max(255).optional().nullable(),
  coordinates_approx: z.string().trim().max(128).optional().nullable(),
  incident_time: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid incident date and time',
  }),
  incident_time_approx: z.union([z.boolean(), z.string().transform((v) => v === 'true' || v === '1')]).default(false),
  category: z.enum(['harassment', 'stalking', 'unsafe_transport', 'assault', 'suspicious_behavior', 'other'], {
    errorMap: () => ({ message: 'Please select a valid incident category' }),
  }),
  description: z.string().trim().min(5, 'Please provide at least a short description (min 5 characters)').max(3000, 'Description cannot exceed 3000 characters'),
  reporter_contact: z.string().trim().max(255).optional().nullable(),
  reporter_contact_note: z.string().trim().max(255).optional().nullable(),
});

export const reportStatusUpdateSchema = z.object({
  status: z.enum(['new', 'reviewing', 'referred', 'closed'], {
    errorMap: () => ({ message: 'Invalid status' }),
  }),
  internal_note: z.string().trim().max(1000).optional().nullable(),
});

export const adminLoginSchema = z.object({
  username: z.string().trim().min(2, 'Username or email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const thresholdSettingsSchema = z.object({
  threshold: z.number().int().min(1, 'Threshold must be at least 1').max(100, 'Threshold cannot exceed 100'),
  window_hours: z.number().int().min(1, 'Window must be at least 1 hour').max(168, 'Window cannot exceed 168 hours (7 days)'),
  retention_days: z.number().int().min(30).max(3650).optional(),
});

export const responderContactSchema = z.object({
  name: z.string().trim().min(2, 'Contact name required').max(128),
  category: z.string().trim().min(2, 'Category required').max(64),
  phone: z.string().trim().min(4, 'Valid phone number required').max(32),
  instructions: z.string().trim().max(1000).optional().nullable(),
  is_active: z.boolean().default(true),
});

export const alertActionSchema = z.object({
  action: z.enum(['acknowledge', 'resolve', 'reopen']),
  note: z.string().trim().max(500).optional().nullable(),
});
