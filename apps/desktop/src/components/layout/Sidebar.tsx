import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../ui/cn.js';

export const nav = [
  { to: '/',           label: 'Dashboard',  icon: '⊞' },
  { to: '/builder',    label: 'New Stack',   icon: '+' },
  { to: '/templates',  label: 'Templates',   icon: '◫' },
  { to: '/history',    label: 'History',     icon: '◷' },
  { to: '/settings',   label: 'Settings',    icon: '⚙' },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 h-full bg-white/80 dark:bg-surface-800/80 glass border-r border-surface-200 dark:border-gray-700/50">
      {/* Logo */}
      <div className="px-5 py-6">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">⏱</span>
          <span className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            Timer Stacks
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {nav.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-accent/10 text-accent dark:bg-accent/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-gray-900 dark:hover:text-gray-100',
              )
            }
          >
            <span className="w-5 text-center text-base leading-none">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-surface-100 dark:border-gray-700/50">
        <p className="text-xs text-gray-400 dark:text-gray-500">Timer Stacks v0.1</p>
      </div>
    </aside>
  );
}
