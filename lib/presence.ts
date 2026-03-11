import { ref, onValue, onDisconnect, set, remove } from 'firebase/database';
import { db } from './firebase';

function getSessionId(userId?: string | null): string {
  try {
    let sid = sessionStorage.getItem('nbc_session_id');
    if (!sid) {
      sid = `${userId || 'anon'}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem('nbc_session_id', sid);
    }
    return sid;
  } catch {
    return `${userId || 'anon'}_${Math.random().toString(36).slice(2)}`;
  }
}

export function trackViewer(auctionId: string, userId?: string | null): () => void {
  // Only track authenticated viewers (presence rules require auth)
  if (!userId) {
    return () => {};
  }

  let hasIncremented = false;
  const sessionId = getSessionId(userId);
  const connectedRef = ref(db, '.info/connected');
  const myPresenceRef = ref(db, `presence/${auctionId}/${sessionId}`);

  const unsub = onValue(connectedRef, (snap) => {
    if (snap.val() === true && !hasIncremented) {
      hasIncremented = true;
      onDisconnect(myPresenceRef).remove();
      set(myPresenceRef, { uid: userId, connectedAt: Date.now() });
    } else if (snap.val() === false) {
      hasIncremented = false;
    }
  });

  return () => {
    unsub();
    hasIncremented = false;
    remove(myPresenceRef);
  };
}
