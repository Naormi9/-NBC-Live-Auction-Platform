import { AuctionStatus, ItemStatus } from '@/lib/types';

const auctionStatusMap: Record<AuctionStatus, { label: string; color: string }> = {
  draft: { label: 'טיוטה', color: 'bg-gray-600/80' },
  published: { label: 'מפורסם', color: 'bg-blue-600/80' },
  live: { label: 'שידור חי', color: 'bg-live-dot' },
  ended: { label: 'הסתיים', color: 'bg-gray-500/80' },
};

const itemStatusMap: Record<ItemStatus, { label: string; color: string }> = {
  pending: { label: 'ממתין', color: 'bg-gray-600/80' },
  active: { label: 'פעיל', color: 'bg-accent' },
  sold: { label: 'נמכר', color: 'bg-bid-price' },
  unsold: { label: 'לא נמכר', color: 'bg-timer-orange' },
};

export function AuctionStatusBadge({ status }: { status: AuctionStatus }) {
  const config = auctionStatusMap[status];
  if (!config) return null;
  return (
    <span className={`${config.color} text-white text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1 flex-shrink-0`}>
      {status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
      {config.label}
    </span>
  );
}

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  const config = itemStatusMap[status];
  if (!config) return null;
  return (
    <span className={`${config.color} text-white text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0`}>
      {config.label}
    </span>
  );
}
