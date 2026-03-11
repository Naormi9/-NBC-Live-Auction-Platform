import { ref, onValue, onDisconnect, set, increment } from 'firebase/database';
import { db } from './firebase';

export function trackViewer(auctionId: string): () => void {
  const connectedRef = ref(db, '.info/connected');
  const viewerRef = ref(db, `auctions/${auctionId}/viewerCount`);
  const myPresenceRef = ref(db, `presence/${auctionId}/${Date.now()}_${Math.random().toString(36).slice(2)}`);

  const unsub = onValue(connectedRef, async (snap) => {
    if (snap.val() === true) {
      // Decrement on disconnect
      onDisconnect(myPresenceRef).remove();
      onDisconnect(viewerRef).set(increment(-1));

      await set(myPresenceRef, true);
      await set(viewerRef, increment(1));
    }
  });

  return unsub;
}
