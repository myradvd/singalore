import type { LocationSignalStatus } from '@/core/location';
import { IconButton } from '../../primitives/IconButton';
import type { IconName } from '../../primitives/Icon';

const STATUS: Record<LocationSignalStatus, { icon: IconName; label: string }> = {
  idle: { icon: 'crosshairs', label: 'Location paused' },
  searching: { icon: 'crosshairs-question', label: 'Finding your location' },
  ok: { icon: 'crosshairs-gps', label: 'GPS signal good' },
  waiting_for_signal: { icon: 'crosshairs-off', label: 'Waiting for GPS signal' },
  permission_needed: { icon: 'map-marker-off-outline', label: 'Location permission needed' },
  services_off: { icon: 'map-marker-off', label: 'Location services are off' },
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
