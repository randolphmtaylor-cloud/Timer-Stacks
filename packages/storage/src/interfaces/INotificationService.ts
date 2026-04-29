export interface NotificationPayload {
  title: string;
  body: string;
  /** Optional sound key for platform-specific audio cue */
  sound?: 'chime' | 'complete' | 'tick';
}

export interface INotificationService {
  /** Request notification permissions. Returns true if granted. */
  requestPermission(): Promise<boolean>;
  /** Show an immediate notification. Silently no-ops if not permitted. */
  show(payload: NotificationPayload): Promise<void>;
  /** Whether notifications are currently permitted */
  isPermitted(): Promise<boolean>;
}
