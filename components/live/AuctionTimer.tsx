'use client';

import { formatTimer, getTimerColor } from '@/lib/auction-utils';

interface AuctionTimerProps {
  secondsLeft: number;
  currentRound: 1 | 2 | 3;
  scheduledCountdown?: number | null;
}

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function AuctionTimer({ secondsLeft, currentRound, scheduledCountdown }: AuctionTimerProps) {
  // Show scheduled countdown if we're waiting for start time
  if (scheduledCountdown !== null && scheduledCountdown !== undefined && scheduledCountdown > 0) {
    return (
      <div className="rounded-xl border p-4 bg-accent/10 text-accent border-accent/30">
        <div className="text-center">
          <div className="text-xs text-text-secondary mb-1">
            המכרז מתחיל בעוד
          </div>
          <div className="text-4xl lg:text-5xl font-black tabular-nums tracking-wider">
            {formatCountdown(scheduledCountdown)}
          </div>
        </div>
      </div>
    );
  }

  const isPaused = secondsLeft < 0;
  const color = isPaused ? 'orange' : getTimerColor(secondsLeft);

  const colorClasses = {
    green: 'bg-timer-green/20 text-timer-green border-timer-green/30',
    orange: 'bg-timer-orange/20 text-timer-orange border-timer-orange/30',
    red: 'bg-timer-red/20 text-timer-red border-timer-red/30',
  };

  const pulseClass = color === 'red' && secondsLeft <= 5
    ? 'timer-pulse-strong'
    : color === 'red'
      ? 'timer-pulse'
      : '';

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]} ${pulseClass}`}>
      <div className="text-center">
        <div className="text-xs text-text-secondary mb-1">
          סיבוב {currentRound} מתוך 3
        </div>
        <div className="text-5xl lg:text-6xl font-black tabular-nums tracking-wider">
          {formatTimer(secondsLeft)}
        </div>
      </div>
    </div>
  );
}
