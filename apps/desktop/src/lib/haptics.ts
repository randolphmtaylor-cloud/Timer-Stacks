export function vibrate(pattern: VibratePattern): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Unsupported in many desktop/browser environments.
  }
}

export function vibrateSegmentComplete(): void {
  vibrate(80);
}

export function vibrateStackComplete(): void {
  vibrate([120, 60, 120]);
}
