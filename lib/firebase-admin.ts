// Firebase Admin SDK configuration
// Used only in server-side contexts (API routes, Cloud Functions)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: any = null;

function getAdmin() {
  if (_admin) return _admin;

  // Dynamic import to avoid bundling in client
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _admin = require('firebase-admin');

  if (_admin.apps.length === 0) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (serviceAccount) {
      // Full service account JSON (production)
      const parsed = JSON.parse(serviceAccount);
      _admin.initializeApp({
        credential: _admin.credential.cert(parsed),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      });
    } else if (process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
      // Individual env vars (alternative)
      _admin.initializeApp({
        credential: _admin.credential.cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      });
    } else {
      // Application default credentials (local dev)
      _admin.initializeApp({
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      });
    }
  }

  return _admin;
}

export async function getAdminDb(): Promise<any> {
  return getAdmin().database();
}

export async function getAdminAuth(): Promise<any> {
  return getAdmin().auth();
}
