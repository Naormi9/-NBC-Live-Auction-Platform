import { ref, onValue, onDisconnect, set, remove } from 'firebase/database';
import { db } from './firebase';

function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let sid = sessionStorage.getItem('nbc_session_id');
  if (!sid) {
    sid = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem('nbc_session_id', sid);
  }
  return sid;
}

let hasIncremented = false;

export function trackViewer(auctionId: string, userId?: string | null): () => void {
  const sessionId = userId || getSessionId();
  const connectedRef = ref(db, '.info/connected');
  const myPresenceRef = ref(db, `presence/${auctionId}/${sessionId}`);

  const unsub = onValue(connectedRef, (snap) => {
    if (snap.val() === true && !hasIncremented) {
      hasIncremented = true;
      onDisconnect(myPresenceRef).remove();
      set(myPresenceRef, true);
    }
  });

  return () => {
    unsub();
    hasIncremented = false;
    remove(myPresenceRef);
  };
}
