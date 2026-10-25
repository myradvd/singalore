import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';

export function StatTile({ value, label, testID }: { value: string; label: string; testID?: string })
{
  return (
    <View testID={testID} style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[typography.title, { color: colors.text }]}>{value}</Text>
      <Text style={[typography.eyebrow, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
});
