import React, { useEffect } from 'react';
import { useSessionStore } from '../../stores/sessionStore.js';
import { useStackStore } from '../../stores/stackStore.js';
import { buildSessionExport, formatMsHuman } from '@timer-stacks/core';
import type { SessionRecord } from '@timer-stacks/core';
import { Card } from '../ui/Card.js';
import { Button } from '../ui/Button.js';

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportButton({ record }: { record: SessionRecord }) {
  const { stacks } = useStackStore();

  function handleExport(e: React.MouseEvent) {
    e.stopPropagation();
    const stack = stacks.find((s) => s.stackId === record.stackId);
    if (!stack) {
      // Stack was deleted — export what we have without segment detail
      downloadJson(
        `session-${record.sessionId.slice(0, 8)}.json`,
        {
          exportVersion: 1,
          exportedAt: new Date().toISOString(),
          stackId: record.stackId,
          stackName: record.stackName,
          sessionId: record.sessionId,
          sessionStatus: record.status,
          startedAt: new Date(record.startedAt).toISOString(),
          endedAt: new Date(record.endedAt).toISOString(),
          totalActualDurationMs: record.totalElapsedMs,
          segmentsCompleted: record.segmentsCompleted,
          totalSegments: record.totalSegments,
          note: 'Stack definition was deleted — segment detail unavailable.',
        },
      );
      return;
    }

    const payload = buildSessionExport(record, stack);
    const datePart = new Date(record.startedAt).toISOString().slice(0, 10);
    const namePart = record.stackName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    downloadJson(`session-${namePart}-${datePart}.json`, payload);
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
      aria-label="Export session as JSON"
      title="Export session as JSON"
      onClick={handleExport}
    >
      ↓ Export
    </Button>
  );
}

export function History() {
  const { history, loadHistory } = useSessionStore();

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-5 sm:px-6 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">History</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {history.length} past session{history.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-5xl mb-4">◷</span>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">No history yet</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            Completed sessions will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((record) => {
            const date = new Date(record.startedAt);
            const isComplete = record.status === 'completed';

            return (
              <Card key={record.recordId} className="flex items-start gap-4">
                {/* Status indicator */}
                <div
                  className={`w-2 h-10 rounded-full shrink-0 ${
                    isComplete ? 'bg-green-400' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {record.stackName}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        isComplete
                          ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {isComplete ? 'Completed' : 'Cancelled'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
                    <span>{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span>·</span>
                    <span>{record.segmentsCompleted}/{record.totalSegments} segments</span>
                    <span>·</span>
                    <span>{formatMsHuman(record.totalElapsedMs)} elapsed</span>
                  </div>
                </div>

                {/* Export */}
                <ExportButton record={record} />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
