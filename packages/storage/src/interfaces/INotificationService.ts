export interface NotificationPayload {
  title: string;
  body: string;
  /** Optional sound key for platform-specific audio cue */
  sound?: 'chime' | 'complete' | 'tick';
}

export interface INotificationService {
  /** Request notification permissions. Returns true if granted. */
  requestPermission(): Promise<boolean>;
  /** Show an immediate notification. Returns false when a platform fallback should be used. */
  show(payload: NotificationPayload): Promise<boolean>;
  /** Whether notifications are currently permitted */
  isPermitted(): Promise<boolean>;
}
