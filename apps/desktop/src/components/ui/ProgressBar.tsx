import React from 'react';
import { cn } from './cn.js';

interface ProgressBarProps {
  value: number; // 0–1
  className?: string;
  trackClassName?: string;
  color?: string;
  height?: 'xs' | 'sm' | 'md';
  animated?: boolean;
  style?: React.CSSProperties;
}

const heightMap = { xs: 'h-1', sm: 'h-1.5', md: 'h-2.5' };

export function ProgressBar({
  value,
  className,
  trackClassName,
  color = 'bg-accent',
  height = 'sm',
  animated = true,
  style,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div
      className={cn(
        'w-full rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden',
        heightMap[height],
        trackClassName,
      )}
      style={style}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(color, 'h-full rounded-full', animated && 'transition-all duration-300 ease-out', className)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
