import { AuctionStatus, ItemStatus } from '@/lib/types';

const auctionStatusMap: Record<AuctionStatus, { label: string; bg: string; text: string }> = {
  draft: { label: 'טיוטה', bg: 'bg-white/10', text: 'text-text-secondary' },
  published: { label: 'מפורסם', bg: 'bg-accent-muted', text: 'text-accent' },
  live: { label: 'שידור חי', bg: 'bg-live-dot/15', text: 'text-live-dot' },
  ended: { label: 'הסתיים', bg: 'bg-white/8', text: 'text-text-secondary' },
};

const itemStatusMap: Record<ItemStatus, { label: string; bg: string; text: string }> = {
  pending: { label: 'ממתין', bg: 'bg-white/10', text: 'text-text-secondary' },
  active: { label: 'פעיל', bg: 'bg-accent-muted', text: 'text-accent' },
  sold: { label: 'נמכר', bg: 'bg-bid-price/15', text: 'text-bid-price' },
  unsold: { label: 'לא נמכר', bg: 'bg-timer-orange/15', text: 'text-timer-orange' },
};

export function AuctionStatusBadge({ status }: { status: AuctionStatus }) {
  const { label, bg, text } = auctionStatusMap[status];
  return (
    <span className={`${bg} ${text} text-xs px-2.5 py-1 rounded-full font-semibold`}>
      {status === 'live' && <span className="live-dot inline-block w-1.5 h-1.5 mr-1.5 align-middle" aria-hidden="true" />}
      {label}
    </span>
  );
}

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  const { label, bg, text } = itemStatusMap[status];
  return (
    <span className={`${bg} ${text} text-xs px-2.5 py-1 rounded-full font-semibold`}>
      {label}
    </span>
  );
}
