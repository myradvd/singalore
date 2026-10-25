import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAppServices } from '@/composition/AppServicesContext';
import type { TourHistoryEntry } from '@/modules/history/HistoryRepository';
import { ListRow } from '../../primitives/ListRow';
import { EmptyState } from '../../primitives/States';
import { ScreenScaffold } from '../shell/ScreenScaffold';

export function HistoryScreen()
{
  const router = useRouter();
  const services = useAppServices();
  const [entries, setEntries] = useState<TourHistoryEntry[] | null>(null);

  useEffect(() =>
  {
    void services.history.list().then(setEntries, () => setEntries([]));
  }, [services]);

  return (
    <ScreenScaffold testID="history-screen" title="Tour History" onBack={() => router.back()}>
      {entries !== null && entries.length === 0 && (
        <EmptyState testID="history-empty" icon="history" title="No tours yet" message="Tours you finish or exit appear here." />
      )}
      {entries?.map((entry) => (
        <ListRow
          key={entry.id}
          icon={entry.status === 'completed' ? 'check-circle-outline' : 'progress-close'}
          title={entry.title}
          subtitle={`${new Date(entry.endedAt).toLocaleDateString()}  ·  ${entry.completedLandmarkIds.length} of ${entry.landmarkIds.length} stops  ·  ${entry.status === 'completed' ? 'Completed' : 'Exited early'}`}
        />
      ))}
    </ScreenScaffold>
  );
}
