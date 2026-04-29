// ---------------------------------------------------------------------------
// Notification message builders — pure domain logic, platform-agnostic.
// Used by both desktop and mobile notification services.
// ---------------------------------------------------------------------------

export interface NotificationMessage {
  title: string;
  body: string;
}

/**
 * Fired when a segment completes and the next one begins.
 * Both completed and next labels are provided so callers can craft the full
 * "X finished → Y starting" message in a single notification.
 */
export function buildSegmentTransitionMessage(
  completedLabel: string,
  nextLabel: string,
): NotificationMessage {
  return {
    title: `✓ ${completedLabel}`,
    body: `Up next: ${nextLabel}`,
  };
}

/**
 * Fired when the very first segment of a stack starts (session begins).
 */
export function buildSessionStartedMessage(
  stackName: string,
  firstSegmentLabel: string,
): NotificationMessage {
  return {
    title: `▶ ${stackName} started`,
    body: `Starting: ${firstSegmentLabel}`,
  };
}

/**
 * Fired when the final segment completes and the stack is done.
 */
export function buildStackCompletedMessage(stackName: string): NotificationMessage {
  return {
    title: `🎉 ${stackName} complete!`,
    body: 'Great work — all segments finished.',
  };
}
