import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.database();

// When a pre-bid is created/updated, find the max pre-bid and update the item's preBidPrice + currentBid
export const onPreBidCreated = functions.region('europe-west1').database
  .ref('/pre_bids/{auctionId}/{itemId}/{userId}')
  .onWrite(async (change, context) => {
    const { auctionId, itemId } = context.params;

    // Read ALL pre-bids for this item and find the maximum
    const allPreBidsSnap = await db.ref(`/pre_bids/${auctionId}/${itemId}`).once('value');
    const allPreBids = allPreBidsSnap.val() || {};

    const maxAmount = Object.values(allPreBids).reduce((max: number, bid: any) => {
      const amount = typeof bid?.amount === 'number' ? bid.amount : 0;
      return amount > max ? amount : max;
    }, 0);

    // Read the item to check status and openingPrice
    const itemSnap = await db.ref(`/auction_items/${itemId}`).once('value');
    const item = itemSnap.val();
    if (!item) return;

    const updateData: Record<string, any> = {
      preBidPrice: maxAmount > 0 ? maxAmount : null,
    };

    // For pending items, also update currentBid to reflect the highest pre-bid
    // This way, when the admin views the item, they see the effective starting price
    if (item.status === 'pending' && maxAmount > 0 && maxAmount > (item.openingPrice || 0)) {
      updateData.currentBid = maxAmount;
    } else if (item.status === 'pending' && maxAmount === 0) {
      // Reset to opening price if all pre-bids were removed
      updateData.currentBid = item.openingPrice || 0;
    }

    await db.ref(`/auction_items/${itemId}`).update(updateData);
  });
