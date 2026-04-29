import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TimerStack } from '@timer-stacks/core';
import { formatMsHuman } from '@timer-stacks/core';
import { useStackStore } from '../../stores/stackStore.js';
import { useSessionStore } from '../../stores/sessionStore.js';
import { Card } from '../ui/Card.js';
import { Button } from '../ui/Button.js';
import { ConfirmDialog } from '../ui/Modal.js';

interface Props {
  stack: TimerStack;
}

export function StackCard({ stack }: Props) {
  const navigate = useNavigate();
  const { delete: deleteStack, duplicate } = useStackStore();
  const { start } = useSessionStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleStart = () => {
    const session = start(stack);
    navigate(`/session/${session.sessionId}`);
  };

  return (
    <>
      <Card hoverable className="group relative min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {stack.icon && <span className="text-xl">{stack.icon}</span>}
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{stack.name}</h3>
            </div>
            {stack.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{stack.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span>{stack.segments.length} segments</span>
              <span>·</span>
              <span>{formatMsHuman(stack.totalDurationMs)}</span>
            </div>
          </div>
          <Button size="sm" variant="primary" onClick={handleStart} className="w-full shrink-0 sm:w-auto">
            ▶ Start
          </Button>
        </div>

        {/* Segment color bar */}
        <div className="flex gap-0.5 mt-4 h-1.5 rounded-full overflow-hidden">
          {stack.segments.map((seg) => (
            <div
              key={seg.segmentId}
              className="rounded-full"
              style={{
                flex: seg.durationMs,
                backgroundColor: seg.color ?? '#6366f1',
              }}
            />
          ))}
        </div>

        {/* Hover actions */}
        <div className="flex flex-wrap gap-1.5 mt-4 opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100">
          <Button size="sm" variant="ghost" onClick={() => navigate(`/builder?edit=${stack.stackId}`)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => duplicate(stack.stackId)}>
            Duplicate
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteStack(stack.stackId)}
        title="Delete Stack"
        message={`Are you sure you want to delete "${stack.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </>
  );
}
