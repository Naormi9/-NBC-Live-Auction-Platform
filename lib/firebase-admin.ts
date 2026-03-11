// Firebase Admin SDK configuration
// Used only in server-side contexts (API routes, Cloud Functions)
// To use: install firebase-admin (npm install firebase-admin)
// Then uncomment and use getAdminDb()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAdminDb(): Promise<any> {
  // Dynamic import to avoid bundling in client
  const adminModule = await (eval('import("firebase-admin")') as Promise<any>);
  const appModule = await (eval('import("firebase-admin/app")') as Promise<any>);
  const dbModule = await (eval('import("firebase-admin/database")') as Promise<any>);

  if (appModule.getApps().length === 0) {
    appModule.initializeApp({
      credential: appModule.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    });
  }

  return dbModule.getDatabase();
}
