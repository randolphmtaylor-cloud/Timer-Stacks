import React, { useState, useCallback } from 'react';
import { parsePastedTimerTasks, type ParsedTask } from '@timer-stacks/core';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';

interface PasteImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (tasks: ParsedTask[]) => void;
}

type Step = 'paste' | 'preview';

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#f59e0b','#10b981','#06b6d4'];

function formatDuration(minutes: number): string {
  const totalSec = Math.round(minutes * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function formatTotalTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const h = Math.floor(m / 60);
  const remainM = m % 60;
  const shortMin = `${m} min`;
  const longHM = h > 0 ? `${h}h ${remainM}m` : null;
  return longHM ? `${shortMin} · ${longHM}` : shortMin;
}

export function PasteImportModal({ open, onClose, onImport }: PasteImportModalProps) {
  const [step, setStep] = useState<Step>('paste');
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ReturnType<typeof parsePastedTimerTasks> | null>(null);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => { setStep('paste'); setRawText(''); setParsed(null); }, 300);
  }, [onClose]);

  function handlePreview() {
    setParsed(parsePastedTimerTasks(rawText));
    setStep('preview');
  }

  function handleImport() {
    if (parsed && parsed.tasks.length > 0) onImport(parsed.tasks);
    handleClose();
  }

  const totalSeconds = parsed?.tasks.reduce((acc, t) => acc + t.durationSeconds, 0) ?? 0;

  return (
    <Modal open={open} onClose={handleClose} title="Paste Tasks" size="md">
      {step === 'paste' ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Paste tasks one per line, ending each with the duration in minutes:{' '}
            <code className="font-mono text-xs bg-surface-100 dark:bg-surface-700 px-1 py-0.5 rounded">Write report (25)</code>
            {' '}or{' '}
            <code className="font-mono text-xs bg-surface-100 dark:bg-surface-700 px-1 py-0.5 rounded">Quick review (7.5)</code>.
          </p>
          <textarea
            autoFocus
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={"Finalize Bobbi's Canada Passport (30)\nRyan Linvill Agreement (45)\nQuick email review (7.5)"}
            rows={8}
            className="w-full text-sm font-mono border border-surface-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button variant="primary" onClick={handlePreview} disabled={rawText.trim().length === 0}>
              Preview →
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Valid tasks */}
          {parsed && parsed.tasks.length > 0 ? (
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  {parsed.tasks.length} task{parsed.tasks.length !== 1 ? 's' : ''} to import
                </h3>
                <span className="text-xs font-mono text-accent font-semibold">
                  {formatTotalTime(totalSeconds)}
                </span>
              </div>
              <ul className="space-y-1.5">
                {parsed.tasks.map((task, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-gray-700/50"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 min-w-0 truncate">
                      {task.title}
                    </span>
                    <span className="text-xs font-mono text-gray-400 dark:text-gray-500 shrink-0">
                      {formatDuration(task.durationMinutes)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No valid tasks found.</p>
          )}

          {/* Skipped lines */}
          {parsed && parsed.skippedLines.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-500 mb-2">
                {parsed.skippedLines.length} line{parsed.skippedLines.length !== 1 ? 's' : ''} skipped
              </h3>
              <ul className="space-y-1.5">
                {parsed.skippedLines.map((s, i) => (
                  <li key={i} className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40">
                    <p className="text-sm font-mono text-gray-700 dark:text-gray-300 truncate">{s.line}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{s.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setStep('paste')}>← Back</Button>
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={!parsed || parsed.tasks.length === 0}
            >
              Import {parsed && parsed.tasks.length > 0 ? `${parsed.tasks.length} Task${parsed.tasks.length !== 1 ? 's' : ''}` : ''}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
