'use client';

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not supported or blocked
  }
}

export function playBidSound() {
  // Rising two-tone — "cha-ching"
  playTone(600, 0.15, 'sine', 0.25);
  setTimeout(() => playTone(800, 0.2, 'sine', 0.25), 150);
}

export function playOutbidSound() {
  // Descending tone — alert
  playTone(500, 0.15, 'triangle', 0.3);
  setTimeout(() => playTone(350, 0.25, 'triangle', 0.3), 150);
}

export function playTimerWarningSound() {
  // Short beep
  playTone(880, 0.1, 'square', 0.15);
}

export function playItemSoldSound() {
  // Celebration: ascending three-note
  playTone(523, 0.15, 'sine', 0.25);
  setTimeout(() => playTone(659, 0.15, 'sine', 0.25), 150);
  setTimeout(() => playTone(784, 0.3, 'sine', 0.25), 300);
}

export function playAuctionEndSound() {
  // Low gong
  playTone(220, 0.8, 'sine', 0.35);
  setTimeout(() => playTone(165, 1.0, 'sine', 0.3), 400);
}
