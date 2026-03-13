'use client';

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
const activeNodes: AudioNode[] = [];

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.72;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
}

function getMaster(): GainNode {
  getCtx();
  return masterGain!;
}

function remember<T extends AudioNode>(node: T): T {
  activeNodes.push(node);
  return node;
}

function cleanupNode(node: AudioNode) {
  try { node.disconnect(); } catch {}
  const idx = activeNodes.indexOf(node);
  if (idx !== -1) activeNodes.splice(idx, 1);
}

function playOsc(
  freq: number,
  type: OscillatorType,
  start: number,
  duration: number,
  gain = 0.2,
  rampTo: number | null = null
) {
  const audio = getCtx();
  const master = getMaster();
  const osc = remember(audio.createOscillator());
  const g = remember(audio.createGain());

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (rampTo) osc.frequency.exponentialRampToValueAtTime(rampTo, start + duration);

  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(gain, start + Math.min(0.01, duration / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(g);
  g.connect(master);
  osc.onended = () => { cleanupNode(osc); cleanupNode(g); };
  osc.start(start);
  osc.stop(start + duration);
}

function playNoise(start: number, duration: number, gain = 0.05, filterFreq = 1800) {
  const audio = getCtx();
  const master = getMaster();
  const bufferSize = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);

  const src = remember(audio.createBufferSource());
  src.buffer = buffer;
  const filter = remember(audio.createBiquadFilter());
  filter.type = 'highpass';
  filter.frequency.value = filterFreq;
  const g = remember(audio.createGain());
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.onended = () => { cleanupNode(src); cleanupNode(filter); cleanupNode(g); };
  src.start(start);
  src.stop(start + duration);
}

// ─── New Bid Placed ─────────────────────────────────────────
// Sharp digital click — tactile live-auction feel
export function playBidSound() {
  try {
    const audio = getCtx();
    const t = audio.currentTime + 0.01;
    playOsc(1280, 'triangle', t, 0.035, 0.14, 520);
    playOsc(2200, 'sine', t, 0.012, 0.05, 1400);
    playNoise(t, 0.018, 0.015, 2200);
  } catch {}
}

// ─── Bid Accepted / Item Sold ───────────────────────────────
// Soft positive confirmation (ascending interval)
export function playItemSoldSound() {
  try {
    const audio = getCtx();
    const t = audio.currentTime + 0.01;
    playOsc(740, 'sine', t, 0.11, 0.12);
    playOsc(988, 'sine', t + 0.10, 0.18, 0.13);
    playOsc(1480, 'triangle', t + 0.10, 0.12, 0.05);
  } catch {}
}

// ─── Outbid Alert ───────────────────────────────────────────
// Quick descending alert with noise texture
export function playOutbidSound() {
  try {
    const audio = getCtx();
    const t = audio.currentTime + 0.01;
    playOsc(1046, 'triangle', t, 0.09, 0.10);
    playOsc(740, 'sine', t + 0.09, 0.15, 0.12);
    playNoise(t, 0.03, 0.012, 1800);
  } catch {}
}

// ─── Timer 10 Second Warning ────────────────────────────────
// Tight urgent ping for countdown
export function playTimer10SecSound() {
  try {
    const audio = getCtx();
    const t = audio.currentTime + 0.005;
    playOsc(1620, 'triangle', t, 0.03, 0.08);
    playNoise(t, 0.018, 0.008, 2600);
  } catch {}
}

// ─── Timer 5 Second Warning ────────────────────────────────
// Slightly louder tick with higher urgency
export function playTimerWarningSound() {
  try {
    const audio = getCtx();
    const t = audio.currentTime + 0.005;
    playOsc(1620, 'triangle', t, 0.03, 0.12);
    playOsc(2400, 'sine', t, 0.015, 0.04);
    playNoise(t, 0.022, 0.012, 2800);
  } catch {}
}

// ─── Auction Open ───────────────────────────────────────────
// Ascending premium glide — grand opening
export function playAuctionEndSound() {
  try {
    const audio = getCtx();
    const t = audio.currentTime + 0.01;
    playOsc(260, 'sine', t, 0.40, 0.08, 520);
    playOsc(390, 'sine', t + 0.16, 0.42, 0.10, 780);
    playOsc(585, 'triangle', t + 0.28, 0.50, 0.08, 1170);
  } catch {}
}

// ─── Auction / Timer End ────────────────────────────────────
// Modern digital gavel — low thud with crisp transient
export function playTimerEndSound() {
  try {
    const audio = getCtx();
    const t = audio.currentTime + 0.01;
    playOsc(96, 'sine', t, 0.18, 0.26, 38);
    playOsc(620, 'square', t, 0.045, 0.05, 180);
    playNoise(t, 0.028, 0.018, 1400);
    playOsc(180, 'triangle', t + 0.03, 0.08, 0.03, 95);
  } catch {}
}

// ─── You Are Leading ────────────────────────────────────────
// Quick positive feedback when you're the highest bidder
export function playLeadingSound() {
  try {
    const audio = getCtx();
    const t = audio.currentTime + 0.01;
    playOsc(880, 'sine', t, 0.08, 0.10);
    playOsc(1174, 'triangle', t + 0.08, 0.11, 0.08);
  } catch {}
}
