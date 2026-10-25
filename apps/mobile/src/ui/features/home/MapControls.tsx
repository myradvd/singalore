import { StyleSheet, View } from 'react-native';
import { IconButton } from '../../primitives/IconButton';
import { spacing } from '../../theme/tokens';

export interface MapControlsProps
{
  onLayersPress: () => void;
  onRecenterPress: () => void;
  onPodcastPreferencesPress?: () => void;
  showCompass?: boolean;
  onCompassPress?: () => void;
}

export function MapControls({ onLayersPress, onRecenterPress, onPodcastPreferencesPress, showCompass = false, onCompassPress }: MapControlsProps)
{
  return (
    <View style={styles.cluster}>
      {showCompass && onCompassPress !== undefined && (
        <IconButton testID="reset-north" icon="compass-rose" accessibilityLabel="Map is rotated. Reset to north up" onPress={onCompassPress} />
      )}
      <IconButton testID="open-layers" icon="layers-outline" accessibilityLabel="Map layers" onPress={onLayersPress} />
      <IconButton testID="recenter" icon="crosshairs-gps" accessibilityLabel="Recenter on my location" onPress={onRecenterPress} variant="primary" />
      {onPodcastPreferencesPress !== undefined && (
        <IconButton testID="podcast-preferences" icon="headphones" accessibilityLabel="Podcast and audio preferences" onPress={onPodcastPreferencesPress} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cluster: { gap: spacing.sm, alignItems: 'center' },
});
