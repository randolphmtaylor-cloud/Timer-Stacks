import React from 'react';
import { cn } from './cn.js';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-dark active:scale-[0.97] shadow-sm',
  secondary:
    'bg-surface-100 dark:bg-surface-800 text-gray-700 dark:text-gray-200 hover:bg-surface-200 dark:hover:bg-gray-700 border border-surface-300 dark:border-gray-600',
  ghost:
    'text-gray-600 dark:text-gray-400 hover:bg-surface-100 dark:hover:bg-surface-800',
  danger:
    'bg-red-500 text-white hover:bg-red-600 active:scale-[0.97] shadow-sm',
};

const sizeClasses: Record<Size, string> = {
  sm:   'min-h-10 px-3 py-2 text-sm rounded-lg md:min-h-0 md:py-1.5',
  md:   'min-h-11 px-4 py-2 text-sm rounded-xl md:min-h-0',
  lg:   'min-h-12 px-6 py-3 text-base rounded-xl md:min-h-0',
  icon: 'min-h-11 min-w-11 p-2 rounded-lg md:min-h-0 md:min-w-0',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50 disabled:pointer-events-none select-none',
        'max-w-full whitespace-nowrap',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : null}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
