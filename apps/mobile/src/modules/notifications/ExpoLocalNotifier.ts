import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { LocalNotifier, NotificationCategory, NotificationPermission } from '@/core/notifications';

const CHANNELS: Record<NotificationCategory, { id: string; name: string; importance: Notifications.AndroidImportance }> = {
  arrivals: { id: 'arrivals', name: 'Heritage site arrivals', importance: Notifications.AndroidImportance.HIGH },
  downloads: { id: 'downloads', name: 'Download completions', importance: Notifications.AndroidImportance.DEFAULT },
  route_updates: { id: 'route_updates', name: 'Route updates', importance: Notifications.AndroidImportance.HIGH },
};

let configured = false;

async function configure(): Promise<void>
{
  if (configured)
  {
    return;
  }
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android')
  {
    for (const channel of Object.values(CHANNELS))
    {
      await Notifications.setNotificationChannelAsync(channel.id, { name: channel.name, importance: channel.importance });
    }
  }
}

function toPermission(status: string): NotificationPermission
{
  if (status === 'granted')
  {
    return 'granted';
  }
  return status === 'denied' ? 'denied' : 'undetermined';
}

export function createExpoLocalNotifier(isCategoryEnabled: (category: NotificationCategory) => boolean): LocalNotifier
{
  return {
    permission: async () =>
    {
      await configure();
      return toPermission((await Notifications.getPermissionsAsync()).status);
    },
    requestPermission: async () =>
    {
      await configure();
      return toPermission((await Notifications.requestPermissionsAsync()).status);
    },
    notify: async (category, title, body, data) =>
    {
      if (!isCategoryEnabled(category))
      {
        return false;
      }
      await configure();
      if (toPermission((await Notifications.getPermissionsAsync()).status) !== 'granted')
      {
        return false;
      }
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { category, ...data } },
        trigger: Platform.OS === 'android' ? { channelId: CHANNELS[category].id } : null,
      });
      return true;
    },
  };
}
