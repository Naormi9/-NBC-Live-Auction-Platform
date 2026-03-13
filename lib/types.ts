export type AuctionStatus = 'draft' | 'published' | 'live' | 'ended';
export type ItemStatus = 'pending' | 'active' | 'sold' | 'unsold';
export type UserRole = 'participant' | 'house_manager' | 'admin';
export type ChatRole = 'user' | 'auctioneer' | 'system';
export type RegistrationStatus = 'pending' | 'approved';

export interface RoundSettings {
  increment: number;
  timerSeconds: number;
}

export interface AuctionSettings {
  round1: RoundSettings;
  round2: RoundSettings;
  round3: RoundSettings;
  hardCloseMinutes: number;
  timerOverrideSeconds?: number | null;
}

export interface Auction {
  id: string;
  title: string;
  houseId: string;
  houseName: string;
  scheduledAt: number;
  status: AuctionStatus;
  preBidsEnabled: boolean;
  currentItemId: string | null;
  currentRound: 1 | 2 | 3;
  timerEndsAt: number;
  timerDuration: number;
  timerPaused?: boolean;
  remainingOnPause?: number;
  viewerCount: number;
  settings: AuctionSettings;
}

export interface AuctionItem {
  id: string;
  auctionId: string;
  order: number;
  title: string;
  description: string;
  images: string[];
  openingPrice: number;
  currentBid: number;
  currentBidderId: string | null;
  currentBidderName: string | null;
  preBidPrice: number | null;
  status: ItemStatus;
  soldAt: number | null;
  soldPrice: number | null;
  make: string;
  model: string;
  year: number;
  km: number;
  color: string;
  engineCC: number;
  owners: number;
  registrationDate: string;
}

export interface PendingBid {
  auctionId: string;
  itemId: string;
  userId: string;
  userDisplayName: string;
  amount: number;
  timestamp: number;
  round: number;
}

export interface PreBid {
  userId: string;
  userDisplayName: string;
  amount: number;
  timestamp: number;
}

export interface BidHistoryEntry {
  userId: string;
  userDisplayName: string;
  amount: number;
  round: number;
  timestamp: number;
}

export interface ChatMessage {
  senderId: string;
  senderName: string;
  senderRole: ChatRole;
  message: string;
  timestamp: number;
}

export interface Registration {
  userId: string;
  registeredAt: number;
  status: RegistrationStatus;
}

export interface UserProfile {
  displayName: string;
  email: string;
  phone: string;
  role: UserRole;
  houseId: string | null;
  createdAt: number;
}
