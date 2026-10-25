import { useLocalSearchParams } from 'expo-router';
import { useCatalogStore } from '@/modules/catalog/catalogStore';
import { PackActionButton } from '@/ui/features/downloads/PackActionButton';
import { ParkDetailScreen } from '@/ui/features/explore/ParkDetailScreen';

export default function ParkDetailRoute()
{
  const { parkId } = useLocalSearchParams<{ parkId: string }>();
  const packBytes = useCatalogStore((state) => state.parksById.get(parkId)?.packBytes ?? 0);
  return <ParkDetailScreen parkId={parkId} parkActions={<PackActionButton parkId={parkId} estimatedBytes={packBytes} />} />;
}
