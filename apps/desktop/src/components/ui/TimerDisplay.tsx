import React from 'react';
import { formatMs } from '@timer-stacks/core';
import { cn } from './cn.js';

interface TimerDisplayProps {
  ms: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  muted?: boolean;
}

const sizeMap = {
  sm: 'text-xl font-semibold tracking-normal',
  md: 'text-3xl font-bold tracking-normal',
  lg: 'text-4xl sm:text-5xl font-bold tracking-normal tabular-nums',
  xl: 'text-5xl sm:text-7xl font-bold tracking-normal tabular-nums',
};

export function TimerDisplay({ ms, size = 'md', className, muted }: TimerDisplayProps) {
  return (
    <span
      className={cn(
        'font-mono',
        sizeMap[size],
        muted ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100',
        className,
      )}
    >
      {formatMs(ms)}
    </span>
  );
}
