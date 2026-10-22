import dotenv from 'dotenv';
dotenv.config();

/**
 * Validates production environment variables at startup.
 * Fails fast and securely without exposing secret values in logs.
 */
export function validateEnvironment() {
  const isProd = process.env.NODE_ENV === 'production';
  const errors = [];

  if (isProd) {
    // 1. Session Secret Security
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      errors.push('SESSION_SECRET is required in production.');
    } else if (secret.includes('development_secret') || secret.length < 32) {
      errors.push('SESSION_SECRET must be a strong, unique secret with at least 32 characters in production.');
    }

    // 2. Database Configuration
    if (!process.env.DB_HOST) errors.push('DB_HOST is required in production.');
    if (!process.env.DB_USER) errors.push('DB_USER is required in production.');
    if (!process.env.DB_PASSWORD) errors.push('DB_PASSWORD is required in production.');
    if (!process.env.DB_NAME) errors.push('DB_NAME is required in production.');

    // 3. Client Origin (CORS)
    if (!process.env.CLIENT_ORIGIN) {
      console.warn('[Security Warning] CLIENT_ORIGIN not specified. Allowing all origins temporarily. Set CLIENT_ORIGIN to your frontend URL once deployed.');
    } else if (process.env.CLIENT_ORIGIN !== '*' && !process.env.CLIENT_ORIGIN.startsWith('https://') && !process.env.CLIENT_ORIGIN.startsWith('http://localhost')) {
      console.warn('[Security Warning] CLIENT_ORIGIN should use HTTPS in production.');
    }

    // 4. Storage Driver Verification
    if (process.env.STORAGE_DRIVER === 's3') {
      if (!process.env.S3_BUCKET) errors.push('S3_BUCKET is required when STORAGE_DRIVER=s3.');
      if (!process.env.S3_ACCESS_KEY_ID) errors.push('S3_ACCESS_KEY_ID is required when STORAGE_DRIVER=s3.');
      if (!process.env.S3_SECRET_ACCESS_KEY) errors.push('S3_SECRET_ACCESS_KEY is required when STORAGE_DRIVER=s3.');
    }
  }

  if (errors.length > 0) {
    console.error('================================================================');
    console.error(' [CRITICAL] SafeSignal Production Configuration Validation Failed:');
    errors.forEach((err) => console.error(` - ${err}`));
    console.error('================================================================');
    throw new Error('Production environment validation failed. Check your hosting provider environment variables.');
  }
}
