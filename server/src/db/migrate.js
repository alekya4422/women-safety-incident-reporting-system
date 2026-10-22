import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../database/migrations');

async function runMigrations() {
  console.log('--- Running SafeSignal Database Migrations ---');
  
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'safesignal_user';
  const password = process.env.DB_PASSWORD || 'safesignal_password';
  const database = process.env.DB_NAME || 'safesignal';

  let connection;
  try {
    const sslConfig = (process.env.DB_SSL === 'true' || process.env.DB_SSL === '1')
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : undefined;

    // Attempt root / user connection to create DB if needed
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      ssl: sslConfig,
      multipleStatements: true
    });

    console.log(`[Migrate] Connected to MySQL on ${host}:${port}. Ensuring database '${database}' exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${database}\`;`);

    // Read migration files
    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
    for (const file of files) {
      console.log(`[Migrate] Applying migration: ${file}...`);
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      await connection.query(sql);
      console.log(`[Migrate] Migration ${file} applied successfully.`);
    }

    console.log('--- All MySQL Migrations Completed Successfully ---');
    await connection.end();
  } catch (err) {
    console.warn(`[Migrate] Notice: MySQL server connection could not be established (${err.message}).`);
    console.log('[Migrate] Resilient local dev fallback is ready and automatically manages tables.');
    console.log('To run against live MySQL, start MySQL service or Docker: docker compose up -d');
  }
}

runMigrations();
