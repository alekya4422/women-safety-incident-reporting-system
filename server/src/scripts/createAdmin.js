import readline from 'readline';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, initDb } from '../db/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function askQuestion(queryText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(queryText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function createAdmin() {
  console.log('====================================================');
  console.log(' SafeSignal Production: Create First Administrator ');
  console.log('====================================================\n');

  await initDb();

  let username = process.env.ADMIN_USERNAME;
  let email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;

  if (!username) {
    username = await askQuestion('Enter Admin Username (e.g. safety_admin): ');
  }
  if (!email) {
    email = await askQuestion('Enter Admin Email (e.g. admin@safesignal.org): ');
  }
  if (!password) {
    password = await askQuestion('Enter Strong Admin Password (min 10 chars): ');
  }

  if (!username || username.length < 3) {
    console.error('Error: Username must be at least 3 characters.');
    process.exit(1);
  }
  if (!email || !email.includes('@')) {
    console.error('Error: A valid email address is required.');
    process.exit(1);
  }
  if (!password || password.length < 10) {
    console.error('Error: Password must be at least 10 characters long for production security.');
    process.exit(1);
  }

  // Hash password with salt rounds = 12
  console.log('\nHashing credentials with bcrypt (cost factor 12)...');
  const passwordHash = bcrypt.hashSync(password, 12);
  const adminId = `usr_${uuidv4().slice(0, 16)}`;

  try {
    // Check if user already exists
    const existing = await query('SELECT id FROM admin_users WHERE username = ? OR email = ?', [username, email]);
    if (existing && existing.length > 0) {
      console.warn(`\n[Notice] An admin account with username '${username}' or email '${email}' already exists.`);
      const overwrite = await askQuestion('Would you like to update the existing password? (y/N): ');
      if (overwrite.toLowerCase() === 'y') {
        await query('UPDATE admin_users SET password_hash = ?, is_active = 1, updated_at = NOW() WHERE username = ? OR email = ?', [passwordHash, username, email]);
        console.log(`\nSuccess: Administrator '${username}' password updated.`);
      } else {
        console.log('\nOperation cancelled. Existing account was not changed.');
      }
      process.exit(0);
    }

    await query(
      `INSERT INTO admin_users (id, username, email, password_hash, role, is_active, created_at)
       VALUES (?, ?, ?, ?, 'superadmin', 1, NOW())`,
      [adminId, username, email, passwordHash]
    );

    console.log('----------------------------------------------------');
    console.log(`[Success] First Administrator created successfully!`);
    console.log(`Username: ${username}`);
    console.log(`Email:    ${email}`);
    console.log(`Role:     superadmin`);
    console.log('----------------------------------------------------');
    console.log('Please store these credentials in a safe password manager.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to create administrator:', err.message);
    process.exit(1);
  }
}

createAdmin();
