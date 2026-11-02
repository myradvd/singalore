import { StyleSheet, Text, View } from 'react-native';
import { useAppServices } from '@/composition/AppServicesContext';
import type { DownloadRecord } from '@/modules/offline/DownloadsRepository';
import { useDownloadsStore } from '@/modules/offline/downloadsStore';
import { PrimaryButton, SecondaryButton } from '../../primitives/Buttons';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { showToast } from '../../toastStore';
import { formatBytes, formatMegabytes } from '../explore/formatBytes';

export function packStatusLabel(record: DownloadRecord | undefined, estimatedBytes: number): string
{
  switch (record?.state)
  {
    case undefined:
    case 'not_downloaded':
      return `Not downloaded  ·  about ${formatBytes(estimatedBytes)}`;
    case 'downloading':
      return `Downloading ${formatMegabytes(record.doneBytes)} of ${formatMegabytes(record.totalBytes)}`;
    case 'paused':
      return `Paused at ${formatMegabytes(record.doneBytes)} of ${formatMegabytes(record.totalBytes)}`;
    case 'downloaded':
      return `Available offline  ·  ${formatBytes(record.totalBytes)}`;
    case 'update_available':
      return 'Update available';
    case 'failed':
      return record.errorCode === 'insufficient_storage' ? 'Not enough storage' : 'Download failed';
  }
}

// Returns how much of the download is done as 0 to 1, safe for a zero total.
export function downloadProgressFraction(doneBytes: number, totalBytes: number): number
{
  return totalBytes > 0 ? Math.min(1, doneBytes / totalBytes) : 0;
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
  const progress = record === undefined ? 0 : downloadProgressFraction(record.doneBytes, record.totalBytes);
  return (
    <View testID={`pack-${parkId}`} style={styles.container}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{packStatusLabel(record, estimatedBytes)}</Text>
      {state === 'downloading' && (
        <View style={styles.track} accessible accessibilityRole="progressbar" accessibilityLabel="Downloading" accessibilityValue={{ min: 0, max: 100, now: Math.floor(progress * 100) }}>
          <View testID="pack-progress-fill" style={[styles.progress, { width: `${progress * 100}%` }]} />
        </View>
      )}
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
  track: { height: 3, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.border },
  progress: { height: 3, backgroundColor: colors.accent },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
