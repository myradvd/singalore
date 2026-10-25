import { formatClock } from '@singalore/shared';
import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '../theme/tokens';

export interface SeekBarProps
{
  positionSeconds: number;
  durationSeconds: number;
  onSeek: (seconds: number) => void;
  stepSeconds?: number;
  testID?: string;
}

export function seekFraction(locationX: number, width: number): number
{
  if (width <= 0)
  {
    return 0;
  }
  return Math.max(0, Math.min(1, locationX / width));
}

export function SeekBar({ positionSeconds, durationSeconds, onSeek, stepSeconds = 10, testID }: SeekBarProps)
{
  const [width, setWidth] = useState(0);
  const [dragFraction, setDragFraction] = useState<number | null>(null);
  const progress = dragFraction ?? (durationSeconds > 0 ? Math.min(1, positionSeconds / durationSeconds) : 0);
  const shownSeconds = dragFraction === null ? positionSeconds : dragFraction * durationSeconds;
  const commit = (fraction: number) =>
  {
    setDragFraction(null);
    onSeek(fraction * durationSeconds);
  };

  return (
    <View style={styles.container}>
      <View
        testID={testID}
        style={styles.touchArea}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => durationSeconds > 0}
        onMoveShouldSetResponder={() => durationSeconds > 0}
        onResponderGrant={(event) => setDragFraction(seekFraction(event.nativeEvent.locationX, width))}
        onResponderMove={(event) => setDragFraction(seekFraction(event.nativeEvent.locationX, width))}
        onResponderRelease={(event) => commit(seekFraction(event.nativeEvent.locationX, width))}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Seek bar"
        accessibilityValue={{ min: 0, max: Math.round(durationSeconds), now: Math.round(positionSeconds), text: `${formatClock(positionSeconds)} of ${formatClock(durationSeconds)}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) =>
        {
          const delta = event.nativeEvent.actionName === 'increment' ? stepSeconds : -stepSeconds;
          onSeek(Math.max(0, Math.min(durationSeconds, positionSeconds + delta)));
        }}
      >
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={[styles.thumb, { left: `${progress * 100}%` }]} />
      </View>
      <View style={styles.times}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{formatClock(shownSeconds)}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{`-${formatClock(Math.max(0, durationSeconds - shownSeconds))}`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  touchArea: { height: 48, justifyContent: 'center' },
  track: { height: 4, borderRadius: radii.pill, backgroundColor: colors.controlTrack, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.accent },
  thumb: { position: 'absolute', width: 18, height: 18, marginLeft: -9, borderRadius: radii.pill, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.surface, ...shadows.card },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
});
