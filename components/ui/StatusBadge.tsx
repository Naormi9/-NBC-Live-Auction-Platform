import { AuctionStatus, ItemStatus } from '@/lib/types';

const auctionStatusMap: Record<AuctionStatus, { label: string; color: string }> = {
  draft: { label: 'טיוטה', color: 'bg-gray-600' },
  published: { label: 'מפורסם', color: 'bg-blue-600' },
  live: { label: 'שידור חי', color: 'bg-live-dot' },
  ended: { label: 'הסתיים', color: 'bg-gray-500' },
};

const itemStatusMap: Record<ItemStatus, { label: string; color: string }> = {
  pending: { label: 'ממתין', color: 'bg-gray-600' },
  active: { label: 'פעיל', color: 'bg-accent' },
  sold: { label: 'נמכר', color: 'bg-bid-price' },
  unsold: { label: 'לא נמכר', color: 'bg-timer-orange' },
};

export function AuctionStatusBadge({ status }: { status: AuctionStatus }) {
  const { label, color } = auctionStatusMap[status];
  return (
    <span className={`${color} text-white text-xs px-2 py-0.5 rounded-full font-medium`}>
      {label}
    </span>
  );
}

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  const { label, color } = itemStatusMap[status];
  return (
    <span className={`${color} text-white text-xs px-2 py-0.5 rounded-full font-medium`}>
      {label}
    </span>
  );
}
