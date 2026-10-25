import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../primitives/Icon';
import { colors, radii, shadows, spacing, typography } from '../../theme/tokens';

export function RouteStrip({ title, stopNames, inProgress, onOpen }: { title: string; stopNames: string[]; inProgress: boolean; onOpen: () => void })
{
  const shown = stopNames.slice(0, 3);
  const extra = stopNames.length - shown.length;
  return (
    <Pressable testID="route-strip" accessibilityRole="button" accessibilityLabel={`${title}, ${stopNames.length} stops. Open the route editor`} onPress={onOpen} style={styles.strip}>
      <View style={styles.header}>
        <Icon name="routes" size={20} color={colors.primary} />
        <Text style={[typography.heading, { color: colors.text, flex: 1 }]}>{title}</Text>
        <Text style={[typography.eyebrow, { color: colors.textMuted }]}>{inProgress ? 'TOUR IN PROGRESS' : `${stopNames.length} STOPS`}</Text>
        <Icon name="chevron-up" size={22} color={colors.textMuted} />
      </View>
      {shown.map((name, index) => (
        <Text key={`${name}-${index}`} style={[typography.body, { color: colors.text }]} numberOfLines={1}>{`${index + 1}  ${name}`}</Text>
      ))}
      {extra > 0 && <Text style={[typography.caption, { color: colors.primary }]}>{`+${extra} more stops`}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: { backgroundColor: colors.glass, borderRadius: radii.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.xs, ...shadows.floating },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
