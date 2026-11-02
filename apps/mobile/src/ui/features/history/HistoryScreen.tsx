import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useAppServices } from '@/composition/AppServicesContext';
import type { HistoryRepository, TourHistoryEntry } from '@/modules/history/HistoryRepository';
import { COPY } from '../../copy';
import { ListRow } from '../../primitives/ListRow';
import { EmptyState, ErrorState } from '../../primitives/States';
import { colors, spacing, typography } from '../../theme/tokens';
import { ScreenScaffold } from '../shell/ScreenScaffold';

type LoadState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; entries: TourHistoryEntry[] };

// Reads the tour history and reports a failure as a state instead of throwing.
async function loadHistory(history: HistoryRepository): Promise<LoadState>
{
  try
  {
    return { status: 'ready', entries: await history.list() };
  }
  catch
  {
    return { status: 'failed' };
  }
}

export function HistoryScreen()
{
  const router = useRouter();
  const services = useAppServices();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  // Loads the history again after the user presses Retry.
  const refresh = useCallback(async () => setLoad(await loadHistory(services.history)), [services]);

  useEffect(() =>
  {
    void loadHistory(services.history).then(setLoad);
  }, [services]);

  return (
    <ScreenScaffold testID="history-screen" title="Tour History" onBack={() => router.back()}>
      {load.status === 'loading' && <Text style={[typography.caption, styles.loading]}>{COPY.historyLoading}</Text>}
      {load.status === 'failed' && <ErrorState testID="history-error" icon="alert-circle-outline" title={COPY.historyLoadFailedTitle} message={COPY.historyLoadFailedMessage} actionLabel={COPY.historyRetry} onAction={() => void refresh()} />}
      {load.status === 'ready' && load.entries.length === 0 && (
        <EmptyState testID="history-empty" icon="history" title="No tours yet" message="Tours you finish or exit appear here." />
      )}
      {load.status === 'ready' && load.entries.map((entry) => (
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

const styles = StyleSheet.create({
  loading: { color: colors.textMuted, padding: spacing.xl },
});
