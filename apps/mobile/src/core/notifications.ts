export type NotificationCategory = 'arrivals' | 'downloads' | 'route_updates';
export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export interface LocalNotifier
{
  permission(): Promise<NotificationPermission>;
  requestPermission(): Promise<NotificationPermission>;
  notify(category: NotificationCategory, title: string, body: string, data?: Record<string, string>): Promise<boolean>;
}

let pendingPermissionCheck: Promise<void> | null = null;

// Asks for notification permission once if undecided; never blocks the caller's action.
export function ensureNotificationPermission(notifier: LocalNotifier): Promise<void>
{
  pendingPermissionCheck ??= requestIfUndetermined(notifier).finally(() =>
  {
    pendingPermissionCheck = null;
  });
  return pendingPermissionCheck;
}

// Requests permission only when the user has not decided yet, ignoring failures.
async function requestIfUndetermined(notifier: LocalNotifier): Promise<void>
{
  try
  {
    if (await notifier.permission() === 'undetermined')
    {
      await notifier.requestPermission();
    }
  }
  catch
  {
    // A failed permission check must not stop the download or tour that follows.
  }
}
