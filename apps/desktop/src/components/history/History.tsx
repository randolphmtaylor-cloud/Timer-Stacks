import React, { useEffect } from 'react';
import { useSessionStore } from '../../stores/sessionStore.js';
import { formatMsHuman } from '@timer-stacks/core';
import { Card } from '../ui/Card.js';
import { Button } from '../ui/Button.js';

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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
