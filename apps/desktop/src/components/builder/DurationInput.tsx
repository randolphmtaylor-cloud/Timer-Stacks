import React, { useState, useEffect } from 'react';
import { cn } from '../ui/cn.js';

interface DurationInputProps {
  valueMs: number;
  onChange: (ms: number) => void;
  className?: string;
  placeholder?: string;
  size?: 'sm' | 'md';
}

/** Displays duration as "M:SS" or "H:MM:SS" and parses back to ms */
export function DurationInput({ valueMs, onChange, className, placeholder = '5:00', size = 'md' }: DurationInputProps) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState(false);

  // Sync display when external value changes (only when not focused)
  useEffect(() => {
    if (!focused) {
      setText(msToDisplay(valueMs));
    }
  }, [valueMs, focused]);

  function msToDisplay(ms: number): string {
    const totalSec = Math.round(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${m}:${pad(s)}`;
  }

  function pad(n: number) { return String(n).padStart(2, '0'); }

  function parseInput(input: string): number | null {
    const cleaned = input.trim();
    // Formats: "5", "5:30", "1:05:30", "5m", "5m30s", "5.5"
    const colonParts = cleaned.split(':');
    if (colonParts.length === 2) {
      const [m, s] = colonParts.map(Number);
      if (!isNaN(m!) && !isNaN(s!)) return (m! * 60 + s!) * 1000;
    }
    if (colonParts.length === 3) {
      const [h, m, s] = colonParts.map(Number);
      if (!isNaN(h!) && !isNaN(m!) && !isNaN(s!)) return (h! * 3600 + m! * 60 + s!) * 1000;
    }
    // Plain number = minutes
    const plain = parseFloat(cleaned);
    if (!isNaN(plain)) return Math.round(plain * 60 * 1000);
    return null;
  }

  function handleBlur() {
    setFocused(false);
    const parsed = parseInput(text);
    if (parsed !== null && parsed > 0) {
      setError(false);
      onChange(parsed);
      setText(msToDisplay(parsed));
    } else {
      setError(true);
      setText(msToDisplay(valueMs));
    }
  }

  return (
    <input
      type="text"
      value={text}
      placeholder={placeholder}
      onChange={(e) => { setText(e.target.value); setError(false); }}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className={cn(
        'font-mono text-center border rounded-lg focus:outline-none focus:ring-2 transition-colors',
        size === 'sm' ? 'px-2 py-1.5 text-sm w-20' : 'px-3 py-2 text-base w-24',
        error
          ? 'border-red-400 bg-red-50 dark:bg-red-950/30 focus:ring-red-400/30 text-red-600'
          : 'border-surface-300 dark:border-gray-600 bg-white dark:bg-surface-700 focus:ring-accent/30 text-gray-900 dark:text-gray-100',
        className,
      )}
    />
  );
}
