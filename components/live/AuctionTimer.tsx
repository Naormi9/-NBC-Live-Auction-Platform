'use client';

import { formatTimer, getTimerColor } from '@/lib/auction-utils';

interface AuctionTimerProps {
  secondsLeft: number;
  currentRound: 1 | 2 | 3;
}

export default function AuctionTimer({ secondsLeft, currentRound }: AuctionTimerProps) {
  const color = getTimerColor(secondsLeft);

  const colorClasses = {
    green: 'bg-timer-green/20 text-timer-green border-timer-green/30',
    orange: 'bg-timer-orange/20 text-timer-orange border-timer-orange/30',
    red: 'bg-timer-red/20 text-timer-red border-timer-red/30',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]} ${color === 'red' ? 'timer-pulse' : ''}`}>
      <div className="text-center">
        <div className="text-xs text-text-secondary mb-1">
          סיבוב {currentRound} מתוך 3
        </div>
        <div className="text-4xl font-bold tabular-nums tracking-wider">
          {formatTimer(secondsLeft)}
        </div>
      </div>
    </div>
  );
}
