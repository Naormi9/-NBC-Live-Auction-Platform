import * as admin from 'firebase-admin';

admin.initializeApp();

export { processBid } from './processBid';
export { timerTick } from './timerManager';
export { onPreBidCreated } from './preBidAggregator';
export {
  startAuctionLive,
  activateFirstItem,
  advanceAuctionRound,
  closeItemAndAdvance,
  adjustAuctionTimer,
  endAuction
} from './auctionControl';
