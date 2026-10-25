import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAppServices } from '@/composition/AppServicesContext';
import type { DownloadRecord } from '@/modules/offline/DownloadsRepository';
import { useDownloadsStore } from '@/modules/offline/downloadsStore';
import { PrimaryButton, SecondaryButton } from '../../primitives/Buttons';
import { colors, spacing, typography } from '../../theme/tokens';
import { showToast } from '../../toastStore';
import { formatBytes } from '../explore/formatBytes';

export function packStatusLabel(record: DownloadRecord | undefined, estimatedBytes: number): string
{
  switch (record?.state)
  {
    case undefined:
    case 'not_downloaded':
      return `Not downloaded  ·  about ${formatBytes(estimatedBytes)}`;
    case 'downloading':
      return `Downloading ${formatBytes(record.doneBytes)} of ${formatBytes(record.totalBytes)}`;
    case 'paused':
      return `Paused at ${formatBytes(record.doneBytes)} of ${formatBytes(record.totalBytes)}`;
    case 'downloaded':
      return `Available offline  ·  ${formatBytes(record.totalBytes)}`;
    case 'update_available':
      return 'Update available';
    case 'failed':
      return record.errorCode === 'insufficient_storage' ? 'Not enough storage' : 'Download failed';
  }
}

export function PackActionButton({ parkId, estimatedBytes }: { parkId: string; estimatedBytes: number })
{
  const services = useAppServices();
  const record = useDownloadsStore((state) => state.records[parkId]);
  const start = async () =>
  {
    const outcome = await services.downloads.download(parkId);
    if (outcome.kind !== 'downloaded')
    {
      showToast(outcome.message, outcome.kind === 'paused' ? 'info' : 'error');
    }
    else
    {
      const permission = await services.notifier.permission();
      if (permission === 'undetermined')
      {
        await services.notifier.requestPermission();
      }
    }
  };
  const state = record?.state ?? 'not_downloaded';
  return (
    <View testID={`pack-${parkId}`} style={styles.container}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{packStatusLabel(record, estimatedBytes)}</Text>
      {state === 'downloading' && <ActivityIndicator color={colors.primary} accessibilityLabel="Downloading" />}
      <View style={styles.actions}>
        {(state === 'not_downloaded' || state === 'failed') && <PrimaryButton testID="pack-download" label="Download for offline use" icon="download" onPress={() => void start()} />}
        {state === 'update_available' && <PrimaryButton testID="pack-update" label="Download update" icon="download" onPress={() => void start()} />}
        {state === 'paused' && <PrimaryButton testID="pack-resume" label="Resume download" icon="play" onPress={() => void start()} />}
        {state === 'downloading' && <SecondaryButton testID="pack-pause" label="Pause" icon="pause" onPress={() => void services.downloads.pause(parkId)} />}
        {(state === 'downloaded' || state === 'update_available' || state === 'paused') && (
          <SecondaryButton testID="pack-delete" label="Remove download" icon="delete-outline" tone="danger" onPress={() => void services.downloads.remove(parkId)} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
