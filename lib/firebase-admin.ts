// Firebase Admin SDK configuration
// Used only in server-side contexts (API routes, Cloud Functions)
// To use: install firebase-admin (npm install firebase-admin)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adminDb: any = null;

export async function getAdminDb(): Promise<any> {
  if (adminDb) return adminDb;

  // Dynamic import to avoid bundling in client
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const admin = require('firebase-admin');

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    });
  }

  adminDb = admin.database();
  return adminDb;
}
