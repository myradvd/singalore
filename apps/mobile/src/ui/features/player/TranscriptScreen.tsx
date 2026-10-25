import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppServices } from '@/composition/AppServicesContext';
import { useAudioStore } from '@/modules/audio/audioStore';
import { useCatalogStore } from '@/modules/catalog/catalogStore';
import { IconButton } from '../../primitives/IconButton';
import { colors, spacing, typography } from '../../theme/tokens';

export const TRANSCRIPT_UNAVAILABLE = 'Transcript currently unavailable for this episode.';

export function TranscriptScreen()
{
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const services = useAppServices();
  const track = useAudioStore((state) => state.track);
  const parkId = useCatalogStore((state) => (track === null ? null : state.landmarksById.get(track.landmarkId)?.parkId ?? null));
  const [transcript, setTranscript] = useState<string | null | undefined>(undefined);

  useEffect(() =>
  {
    let cancelled = false;
    if (track === null)
    {
      return undefined;
    }
    (async () =>
    {
      let text = await services.packDetails.transcript(track.podcastId);
      if (text === undefined && parkId !== null && services.connectivity.isOnline())
      {
        try
        {
          await services.packDetails.fetchPack(parkId);
          text = await services.packDetails.transcript(track.podcastId);
        }
        catch
        {
          text = null;
        }
      }
      if (!cancelled)
      {
        setTranscript(text ?? null);
      }
    })();
    return () =>
    {
      cancelled = true;
    };
  }, [track, parkId, services]);

  return (
    <View testID="transcript-screen" style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <IconButton testID="transcript-close" icon="close" accessibilityLabel="Close transcript" onPress={() => router.back()} variant="plain" />
        <Text style={[typography.heading, { color: colors.text, flex: 1 }]} numberOfLines={1} accessibilityRole="header">{track?.title ?? 'Transcript'}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
        {track !== null && transcript === undefined
          ? <ActivityIndicator color={colors.primary} accessibilityLabel="Loading transcript" />
          : <Text testID="transcript-text" style={[typography.reading, styles.text]}>{transcript === null || transcript === undefined || transcript.trim().length === 0 ? TRANSCRIPT_UNAVAILABLE : transcript}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  text: { color: colors.text },
});
