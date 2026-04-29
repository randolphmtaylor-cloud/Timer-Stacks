// ---------------------------------------------------------------------------
// Shared storage key names and limits — used by all platform adapters.
// ---------------------------------------------------------------------------

export const STORAGE_KEYS = {
  stacks:         'ts:stacks',
  activeSessions: 'ts:active-sessions',
  history:        'ts:history',
} as const;

export const HISTORY_LIMIT = 500;
