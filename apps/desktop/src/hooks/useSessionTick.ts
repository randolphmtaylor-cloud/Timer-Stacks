// ---------------------------------------------------------------------------
// useSessionTick — subscribes to a session and returns live computed state.
// The SessionManager's internal interval drives updates; this hook just
// re-reads the computed state on each React render tick.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import type { SessionState } from '@timer-stacks/core';
import { sessionManager } from '../stores/sessionStore.js';

export function useSessionTick(sessionId: string | null, rateMs = 100): SessionState | null {
  const [state, setState] = useState<SessionState | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const update = () => {
      const s = sessionManager.getSessionState(sessionId);
      setState(s);
    };

    update();
    const id = setInterval(update, rateMs);
    return () => clearInterval(id);
  }, [sessionId, rateMs]);

  return state;
}
