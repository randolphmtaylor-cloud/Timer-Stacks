type WebAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

let audioContext: AudioContext | null = null;
let unlocked = false;
let lastBlockedMessageAt = 0;

const BLOCKED_EVENT = 'timer-stacks-audio-blocked';

type AudioBlockedDetail = {
  message: string;
};

function emitAudioBlocked(message = 'Tap Enable Sound to hear timer chimes.'): void {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  if (now - lastBlockedMessageAt < 1500) return;
  lastBlockedMessageAt = now;
  window.dispatchEvent(new CustomEvent<AudioBlockedDetail>(BLOCKED_EVENT, { detail: { message } }));
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor = window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;
  if (!AudioContextCtor) return null;

  try {
    audioContext ??= new AudioContextCtor();
    return audioContext;
  } catch {
    return null;
  }
}

function playSilentTestTone(ctx: AudioContext): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(440, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.setValueAtTime(0.0001, now + 0.04);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.04);
}

export function isAudioUnlocked(): boolean {
  return unlocked && audioContext?.state === 'running';
}

export async function unlockAudio(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) {
    emitAudioBlocked('Audio is not available in this browser.');
    return false;
  }

  try {
    if (ctx.state === 'suspended') await ctx.resume();
    playSilentTestTone(ctx);
    unlocked = ctx.state === 'running';
    console.info('[audio] Unlock attempted', { state: ctx.state, unlocked });
    if (!unlocked) {
      emitAudioBlocked();
    }
    return unlocked;
  } catch (error) {
    unlocked = false;
    console.error('[audio] Unlock failed', error);
    emitAudioBlocked();
    return false;
  }
}

export async function unlockNotificationAudio(): Promise<void> {
  await unlockAudio();
}

function playTone(frequency: number, startAt: number, duration: number, gainValue: number): boolean {
  const ctx = getAudioContext();
  if (!ctx || !isAudioUnlocked()) {
    emitAudioBlocked();
    return false;
  }

  try {
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
    console.info('[audio] Tone scheduled', { frequency, duration });
    return true;
  } catch (error) {
    console.error('[audio] Tone scheduling failed', error);
    emitAudioBlocked();
    return false;
  }
}

export function playTransitionSound(): boolean {
  const ctx = getAudioContext();
  if (!ctx || !isAudioUnlocked()) {
    emitAudioBlocked();
    return false;
  }

  const now = ctx.currentTime;
  const first = playTone(880, now, 0.13, 0.08);
  const second = playTone(1175, now + 0.14, 0.16, 0.07);
  return first || second;
}

export function playCompletionSound(): boolean {
  const ctx = getAudioContext();
  if (!ctx || !isAudioUnlocked()) {
    emitAudioBlocked();
    return false;
  }

  const now = ctx.currentTime;
  const first = playTone(659, now, 0.12, 0.1);
  const second = playTone(880, now + 0.13, 0.12, 0.1);
  const third = playTone(1319, now + 0.27, 0.28, 0.09);
  return first || second || third;
}

export function playSegmentCompleteSound(): boolean {
  return playTransitionSound();
}

export function playStackCompleteSound(): boolean {
  return playCompletionSound();
}
