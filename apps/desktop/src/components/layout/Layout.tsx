import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { nav, Sidebar } from './Sidebar.js';
import { cn } from '../ui/cn.js';

export function Layout() {
  return (
    <div className="app-viewport flex flex-col md:flex-row overflow-hidden bg-surface-50 dark:bg-surface-950">
      <MobileHeader />
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto overscroll-contain safe-bottom">
        <Outlet />
      </main>
    </div>
  );
}

function MobileHeader() {
  return (
    <header className="md:hidden shrink-0 safe-top safe-x bg-white/85 dark:bg-surface-900/90 glass border-b border-surface-200 dark:border-gray-800">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-xl leading-none">⏱</span>
          <span className="truncate text-[15px] font-semibold text-gray-900 dark:text-gray-100">
            Timer Stacks
          </span>
        </div>
        <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">v0.1</span>
      </div>
      <nav className="flex flex-wrap gap-1 px-3 pb-3">
        {nav.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent/10 text-accent dark:bg-accent/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-surface-100 dark:hover:bg-surface-800',
              )
            }
          >
            <span className="text-base leading-none">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
