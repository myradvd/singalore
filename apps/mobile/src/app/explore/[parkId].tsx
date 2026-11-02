import { useLocalSearchParams } from 'expo-router';
import { useCatalogStore } from '@/modules/catalog/catalogStore';
import { PackActionButton } from '@/ui/features/downloads/PackActionButton';
import { AddStopButton } from '@/ui/features/explore/AddStopButton';
import { ParkDetailScreen } from '@/ui/features/explore/ParkDetailScreen';

export default function ParkDetailRoute()
{
  const { parkId, site } = useLocalSearchParams<{ parkId: string; site?: string }>();
  const packBytes = useCatalogStore((state) => state.parksById.get(parkId)?.packBytes ?? 0);
  return (
    <ParkDetailScreen
      parkId={parkId}
      focusSiteId={site}
      parkActions={<PackActionButton parkId={parkId} estimatedBytes={packBytes} />}
      renderLandmarkTrailing={(landmark) => <AddStopButton landmarkId={landmark.id} landmarkName={landmark.name} testID={`add-stop-${landmark.slug}`} />}
    />
  );
}
