import * as admin from 'firebase-admin';

admin.initializeApp();

export { processBid } from './processBid';
export { advanceRoundOrItem } from './advanceItem';
export { timerTick } from './timerManager';
