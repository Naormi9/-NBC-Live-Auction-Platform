import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.database();

// When a pre-bid is created/updated, find the max pre-bid and update the item's preBidPrice
export const onPreBidCreated = functions.database
  .ref('/pre_bids/{auctionId}/{itemId}/{userId}')
  .onWrite(async (change, context) => {
    const { auctionId, itemId } = context.params;

    // Read ALL pre-bids for this item and find the maximum
    const allPreBidsSnap = await db.ref(`/pre_bids/${auctionId}/${itemId}`).once('value');
    const allPreBids = allPreBidsSnap.val() || {};

    const maxAmount = Object.values(allPreBids).reduce((max: number, bid: any) => {
      return bid.amount > max ? bid.amount : max;
    }, 0);

    if (maxAmount > 0) {
      await db.ref(`/auction_items/${itemId}`).update({
        preBidPrice: maxAmount,
      });
    }
  });
