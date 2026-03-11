import { auth } from './firebase';

const FUNCTIONS_BASE = `https://europe-west1-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'nbc-auction'}.cloudfunctions.net`;

export async function callFunction(name: string, data: Record<string, any> = {}): Promise<any> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const token = await user.getIdToken();

  const response = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || `Function ${name} failed with status ${response.status}`);
  }

  return result;
}
