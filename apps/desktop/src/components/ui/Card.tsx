import React from 'react';
import { cn } from './cn.js';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export function Card({ hoverable, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-surface-800 rounded-2xl shadow-card dark:shadow-card-dark border border-surface-200 dark:border-gray-700/50 p-5',
        hoverable && 'cursor-pointer hover:shadow-float transition-shadow duration-200',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
