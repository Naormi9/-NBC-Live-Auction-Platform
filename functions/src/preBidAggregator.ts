import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.database();

// When a pre-bid is created/updated, find the max pre-bid and update the item's preBidPrice
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

    // Update item's preBidPrice (set to null if no valid bids remain)
    await db.ref(`/auction_items/${itemId}`).update({
      preBidPrice: maxAmount > 0 ? maxAmount : null,
    });
  });
