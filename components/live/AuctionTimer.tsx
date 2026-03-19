'use client';

import { formatTimer, getTimerColor } from '@/lib/auction-utils';

interface AuctionTimerProps {
  secondsLeft: number;
  currentRound: 1 | 2 | 3;
}

export default function AuctionTimer({ secondsLeft, currentRound }: AuctionTimerProps) {
  const isPaused = secondsLeft < 0;
  const color = isPaused ? 'orange' : getTimerColor(secondsLeft);

  const colorClasses = {
    green: 'bg-timer-green/15 text-timer-green border-timer-green/25',
    orange: 'bg-timer-orange/15 text-timer-orange border-timer-orange/25',
    red: 'bg-timer-red/15 text-timer-red border-timer-red/25',
  };

  const glowClasses = {
    green: '',
    orange: '',
    red: 'shadow-[0_0_20px_rgba(244,63,94,0.2)]',
  };

  const pulseClass = color === 'red' && secondsLeft <= 5
    ? 'timer-pulse-strong'
    : color === 'red'
      ? 'timer-pulse'
      : '';

  return (
    <div
      className={`rounded-xl border p-4 transition-colors-fast ${colorClasses[color]} ${glowClasses[color]} ${pulseClass}`}
      role="timer"
      aria-live="polite"
      aria-label={isPaused ? 'טיימר מושהה' : `נותרו ${Math.ceil(secondsLeft)} שניות`}
    >
      <div className="text-center">
        <div className="text-xs text-text-secondary mb-1">
          סיבוב {currentRound} מתוך 3
        </div>
        <div className="text-5xl lg:text-6xl font-black text-mono-nums tracking-wider">
          {formatTimer(secondsLeft)}
        </div>
        {isPaused && (
          <div className="text-xs mt-1 font-medium opacity-80">מושהה</div>
        )}
      </div>
    </div>
  );
}
