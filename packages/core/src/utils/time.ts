// ---------------------------------------------------------------------------
// Time formatting utilities — shared across platforms
// ---------------------------------------------------------------------------

/**
 * Format milliseconds as "MM:SS" (e.g. 7.5 min → "07:30")
 */
export function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Format milliseconds as a human-readable string (e.g. "7m 30s", "1h 15m")
 */
export function formatMsHuman(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0 && seconds > 0) return `${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

/**
 * Parse "MM:SS" or "HH:MM:SS" string to milliseconds
 */
export function parseTimeString(input: string): number | null {
  const parts = input.trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;

  if (parts.length === 2) {
    const [m, s] = parts as [number, number];
    return (m * 60 + s) * 1000;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts as [number, number, number];
    return (h * 3600 + m * 60 + s) * 1000;
  }
  return null;
}

/**
 * Convert minutes to milliseconds
 */
export function minutesToMs(minutes: number): number {
  return Math.round(minutes * 60 * 1000);
}

/**
 * Convert milliseconds to minutes
 */
export function msToMinutes(ms: number): number {
  return ms / 60000;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
