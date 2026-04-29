import { useEffect, useState } from 'react';
import type { SessionState } from '@timer-stacks/core';
import { sessionManager } from '../stores/sessionStore.js';

export function useSessionTick(sessionId: string | null, rateMs = 100): SessionState | null {
  const [state, setState] = useState<SessionState | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const update = () => setState(sessionManager.getSessionState(sessionId));
    update();
    const id = setInterval(update, rateMs);
    return () => clearInterval(id);
  }, [sessionId, rateMs]);

  return state;
}
