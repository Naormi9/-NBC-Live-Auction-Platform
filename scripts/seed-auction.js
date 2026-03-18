#!/usr/bin/env node

/**
 * Seed Auction Script
 * Creates a new auction with 5 car items in Firebase RTDB using Admin SDK.
 *
 * Usage:
 *   node scripts/seed-auction.js
 *
 * Requires .env.local with Firebase config.
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
  admin.initializeApp({ databaseURL });
}

// March 31, 2026 12:00 Israel time (UTC+2 for IST / UTC+3 for IDT)
// Late March is already in IDT (daylight saving), so UTC+3
const SCHEDULED_AT = new Date('2026-03-31T12:00:00+03:00').getTime();

const ITEMS = [
  {
    order: 1,
    title: 'MG ZS EV 2021 — חשמלי',
    description: 'רכב חשמלי מלא, MG ZS EV דגם 2021. טווח נסיעה כ-260 ק"מ, טעינה מהירה, מערכת מולטימדיה עם מסך מגע, מצלמת רוורס, חיישני חניה.',
    make: 'MG',
    model: 'ZS EV',
    year: 2021,
    km: 155000,
    color: 'תכלת',
    engineCC: 0,
    owners: 2,
    registrationDate: '03/2021',
    openingPrice: 25000,
    images: ['https://placehold.co/800x500/1a1a2e/00d4aa?text=MG+ZS+EV+2021'],
  },
  {
    order: 2,
    title: 'Ford Edge ST 2019 — טורבו בנזין',
    description: 'Ford Edge ST דגם 2019, מנוע 2.7 טורבו בנזין EcoBoost, 335 כ"ס, הנעה כפולה AWD, יד ראשונה. ריפודי עור, גג פנורמי, מערכת B&O.',
    make: 'Ford',
    model: 'Edge ST',
    year: 2019,
    km: 120000,
    color: 'שחור',
    engineCC: 2700,
    owners: 1,
    registrationDate: '06/2019',
    openingPrice: 45000,
    images: ['https://placehold.co/800x500/1a1a2e/00d4aa?text=Ford+Edge+ST+2019'],
  },
  {
    order: 3,
    title: 'Dacia Duster 2020 — בנזין',
    description: 'Dacia Duster דגם 2020, מנוע 1.6 בנזין, SUV קומפקטי ושטח. מערכת מולטימדיה, מצלמת רוורס, חיישני חניה, מצב נהיגת שטח.',
    make: 'Dacia',
    model: 'Duster',
    year: 2020,
    km: 80000,
    color: 'זהוב/חאקי',
    engineCC: 1600,
    owners: 2,
    registrationDate: '01/2020',
    openingPrice: 30000,
    images: ['https://placehold.co/800x500/1a1a2e/00d4aa?text=Dacia+Duster+2020'],
  },
  {
    order: 4,
    title: 'Peugeot 2008 2022 — בנזין',
    description: 'Peugeot 2008 דגם 2022, מנוע 1.2 טורבו בנזין PureTech, עיצוב מודרני, קוקפיט דיגיטלי i-Cockpit, מערכת בטיחות מתקדמת ADAS.',
    make: 'Peugeot',
    model: '2008',
    year: 2022,
    km: 50000,
    color: 'לבן',
    engineCC: 1200,
    owners: 1,
    registrationDate: '04/2022',
    openingPrice: 40000,
    images: ['https://placehold.co/800x500/1a1a2e/00d4aa?text=Peugeot+2008+2022'],
  },
  {
    order: 5,
    title: 'Nissan Qashqai 2020 — בנזין',
    description: 'Nissan Qashqai דגם 2020, מנוע 1.6 בנזין, קרוסאובר משפחתי. מערכת ProPilot, מצלמת 360, ניווט, ריפודי עור, גג פנורמי.',
    make: 'Nissan',
    model: 'Qashqai',
    year: 2020,
    km: 60000,
    color: 'לבן',
    engineCC: 1600,
    owners: 1,
    registrationDate: '09/2020',
    openingPrice: 35000,
    images: ['https://placehold.co/800x500/1a1a2e/00d4aa?text=Nissan+Qashqai+2020'],
  },
];

async function seed() {
  const db = admin.database();

  console.log('=== Seed Auction ===');
  console.log(`Database: ${databaseURL}\n`);

  // Check if there's an existing house for "מיכאלי מוטורס"
  const housesSnap = await db.ref('houses').once('value');
  let houseId = 'michaeli-motors';
  if (housesSnap.exists()) {
    const houses = housesSnap.val();
    for (const [id, house] of Object.entries(houses)) {
      if (house.name === 'מיכאלי מוטורס') {
        houseId = id;
        break;
      }
    }
  }

  // Ensure the house exists
  await db.ref(`houses/${houseId}`).update({
    name: 'מיכאלי מוטורס',
    createdAt: Date.now(),
  });
  console.log(`House: ${houseId}`);

  // Create auction
  const auctionRef = db.ref('auctions').push();
  const auctionId = auctionRef.key;

  const auctionData = {
    id: auctionId,
    title: 'מכרז רכבים מרץ 2026 — מיכאלי מוטורס',
    houseId,
    houseName: 'מיכאלי מוטורס',
    scheduledAt: SCHEDULED_AT,
    status: 'published',
    preBidsEnabled: true,
    currentItemId: null,
    currentRound: 1,
    timerEndsAt: 0,
    timerDuration: 0,
    timerPaused: false,
    viewerCount: 0,
    settings: {
      round1: { increment: 1000, timerSeconds: 45 },
      round2: { increment: 500, timerSeconds: 30 },
      round3: { increment: 250, timerSeconds: 30 },
      hardCloseMinutes: 30,
      timerOverrideSeconds: null,
    },
  };

  await auctionRef.set(auctionData);
  console.log(`Auction created: ${auctionId}`);
  console.log(`  Title: ${auctionData.title}`);
  console.log(`  Scheduled: ${new Date(SCHEDULED_AT).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`);
  console.log(`  Status: ${auctionData.status}`);
  console.log(`  Pre-bids: ${auctionData.preBidsEnabled}\n`);

  // Create items
  console.log('Creating items...');
  for (const item of ITEMS) {
    const itemRef = db.ref('auction_items').push();
    const itemId = itemRef.key;

    await itemRef.set({
      id: itemId,
      auctionId,
      order: item.order,
      title: item.title,
      description: item.description,
      images: item.images,
      openingPrice: item.openingPrice,
      currentBid: 0,
      currentBidderId: null,
      currentBidderName: null,
      preBidPrice: null,
      status: 'pending',
      soldAt: null,
      soldPrice: null,
      winnerId: null,
      winnerName: null,
      winnerPaymentStatus: null,
      make: item.make,
      model: item.model,
      year: item.year,
      km: item.km,
      color: item.color,
      engineCC: item.engineCC,
      owners: item.owners,
      registrationDate: item.registrationDate,
    });

    console.log(`  ${item.order}. ${item.title} (${itemId}) — ₪${item.openingPrice.toLocaleString()}`);
  }

  console.log(`\nSeed complete! Auction "${auctionData.title}" is published with ${ITEMS.length} items.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
