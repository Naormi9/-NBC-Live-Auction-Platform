#!/usr/bin/env node

/**
 * Firebase DB Cleanup Script
 * Uses Firebase Admin SDK to bypass RTDB rules and delete all auction data.
 *
 * Usage:
 *   node scripts/cleanup.js
 *
 * Requires .env.local with Firebase config (NEXT_PUBLIC_FIREBASE_DATABASE_URL)
 * and one of:
 *   - FIREBASE_SERVICE_ACCOUNT (JSON string)
 *   - FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY
 *   - GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON file)
 */

const path = require('path');
const fs = require('fs');

// Load .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const admin = require('firebase-admin');

// Initialize Admin SDK
const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
if (!databaseURL) {
  console.error('Missing NEXT_PUBLIC_FIREBASE_DATABASE_URL in .env.local');
  process.exit(1);
}

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (serviceAccount) {
  const parsed = JSON.parse(serviceAccount);
  admin.initializeApp({
    credential: admin.credential.cert(parsed),
    databaseURL,
  });
} else if (process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    databaseURL,
  });
} else {
  // Application default credentials
  admin.initializeApp({ databaseURL });
}

const PATHS_TO_DELETE = [
  'auctions',
  'auction_items',
  'bid_history',
  'pre_bids',
  'live_chat',
  'registrations',
  'pending_bids',
  'timer_locks',
  'presence',
];

async function cleanup() {
  const db = admin.database();

  console.log('=== Firebase DB Cleanup ===');
  console.log(`Database: ${databaseURL}`);
  console.log(`Deleting ${PATHS_TO_DELETE.length} paths...\n`);

  // Build multi-path update (set all to null)
  const updates = {};
  for (const p of PATHS_TO_DELETE) {
    updates[p] = null;
  }

  await db.ref('/').update(updates);
  console.log('All paths deleted successfully.\n');

  // Verify DB is empty
  console.log('Verifying...');
  for (const p of PATHS_TO_DELETE) {
    const snap = await db.ref(p).once('value');
    const status = snap.exists() ? 'STILL HAS DATA' : 'empty';
    console.log(`  /${p}: ${status}`);
  }

  console.log('\nCleanup complete!');
  process.exit(0);
}

cleanup().catch((err) => {
  console.error('Cleanup failed:', err.message);
  process.exit(1);
});
