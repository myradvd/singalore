export type NotificationCategory = 'arrivals' | 'downloads' | 'route_updates';
export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export interface LocalNotifier
{
  permission(): Promise<NotificationPermission>;
  requestPermission(): Promise<NotificationPermission>;
  notify(category: NotificationCategory, title: string, body: string, data?: Record<string, string>): Promise<boolean>;
}
