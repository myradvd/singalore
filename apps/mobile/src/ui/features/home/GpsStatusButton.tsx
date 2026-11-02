import type { LocationSignalStatus } from '@/core/location';
import { IconButton } from '../../primitives/IconButton';
import type { IconName } from '../../primitives/Icon';

const STATUS: Record<LocationSignalStatus, { icon: IconName; label: string }> = {
  idle: { icon: 'signal-cellular-outline', label: 'Location paused' },
  searching: { icon: 'signal-cellular-1', label: 'Finding your location' },
  ok: { icon: 'signal-cellular-3', label: 'GPS signal good' },
  waiting_for_signal: { icon: 'signal-cellular-outline', label: 'Waiting for GPS signal' },
  permission_needed: { icon: 'signal-off', label: 'Location permission needed' },
  services_off: { icon: 'signal-off', label: 'Location services are off' },
};

export function gpsStatusLabel(status: LocationSignalStatus): string
{
  return STATUS[status].label;
}

export function GpsStatusButton({ status, onPress }: { status: LocationSignalStatus; onPress: () => void })
{
  const entry = STATUS[status];
  return <IconButton testID="gps-status" icon={entry.icon} accessibilityLabel={entry.label} onPress={onPress} variant={status === 'ok' ? 'plain' : 'glass'} />;
}
