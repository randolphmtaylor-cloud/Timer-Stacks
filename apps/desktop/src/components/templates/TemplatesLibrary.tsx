import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatMsHuman } from '@timer-stacks/core';
import type { TimerStack } from '@timer-stacks/core';
import { useStackStore } from '../../stores/stackStore.js';
import { useSessionStore } from '../../stores/sessionStore.js';
import { Card } from '../ui/Card.js';
import { Button } from '../ui/Button.js';
import { ConfirmDialog } from '../ui/Modal.js';

export function TemplatesLibrary() {
  const navigate = useNavigate();
  const { stacks, duplicate, delete: deleteStack } = useStackStore();
  const { start } = useSessionStore();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const templates = stacks.filter((s) => s.isTemplate);

  function handleStartFromTemplate(template: TimerStack) {
    const session = start(template);
    navigate(`/session/${session.sessionId}`);
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-5 sm:px-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 md:mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Templates</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Reusable timer routines
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate('/builder?template=1')} className="shrink-0">
          + New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-5xl mb-4">◫</span>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">No templates yet</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
            Save any stack as a template to quickly start the same routine again.
          </p>
          <Button variant="primary" onClick={() => navigate('/builder?template=1')}>
            Create Template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <Card key={template.stackId} className="group">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {template.icon && <span className="text-xl">{template.icon}</span>}
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {template.name}
                    </h3>
                  </div>
                  {template.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {template.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{template.segments.length} segments</span>
                    <span>·</span>
                    <span>{formatMsHuman(template.totalDurationMs)}</span>
                  </div>
                </div>
              </div>

              {/* Segment list */}
              <div className="space-y-1.5 mb-4">
                {template.segments.map((seg, i) => (
                  <div key={seg.segmentId} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color ?? '#6366f1' }}
                    />
                    <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">{seg.label}</span>
                    <span className="text-gray-400 font-mono text-xs shrink-0">
                      {formatMsHuman(seg.durationMs)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Color bar */}
              <div className="flex gap-0.5 h-1 rounded-full overflow-hidden mb-4">
                {template.segments.map((seg) => (
                  <div
                    key={seg.segmentId}
                    style={{ flex: seg.durationMs, backgroundColor: seg.color ?? '#6366f1' }}
                  />
                ))}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="primary" onClick={() => handleStartFromTemplate(template)} className="flex-1 sm:flex-none">
                  ▶ Start
                </Button>
                <Button size="sm" variant="secondary" onClick={() => navigate(`/builder?edit=${template.stackId}`)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => duplicate(template.stackId)}>
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-400 hover:text-red-600 sm:ml-auto"
                  onClick={() => setConfirmDelete(template.stackId)}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { if (confirmDelete) deleteStack(confirmDelete); }}
        title="Delete Template"
        message="Are you sure you want to delete this template? This cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
