type WebAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

let audioContext: AudioContext | null = null;
let unlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor = window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;
  if (!AudioContextCtor) return null;
  audioContext ??= new AudioContextCtor();
  return audioContext;
}

export async function unlockNotificationAudio(): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') await ctx.resume();
    unlocked = true;
  } catch {
    // Audio cues are best-effort; notifications still provide the primary signal.
  }
}

function playTone(frequency: number, startAt: number, duration: number, gainValue: number): void {
  const ctx = getAudioContext();
  if (!ctx || !unlocked) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

export function playSegmentCompleteSound(): void {
  const ctx = getAudioContext();
  if (!ctx || !unlocked) return;

  const now = ctx.currentTime;
  playTone(880, now, 0.13, 0.08);
  playTone(1175, now + 0.14, 0.16, 0.07);
}

export function playStackCompleteSound(): void {
  const ctx = getAudioContext();
  if (!ctx || !unlocked) return;

  const now = ctx.currentTime;
  playTone(659, now, 0.12, 0.1);
  playTone(880, now + 0.13, 0.12, 0.1);
  playTone(1319, now + 0.27, 0.28, 0.09);
}
