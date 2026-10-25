import { StyleSheet, Switch, Text, View } from 'react-native';
import { colors, spacing, touchTargets, typography } from '../theme/tokens';

export interface ToggleProps
{
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  description?: string;
  disabled?: boolean;
  disabledReason?: string;
  testID?: string;
}

export function Toggle({ label, value, onValueChange, description, disabled = false, disabledReason, testID }: ToggleProps)
{
  const caption = disabled && disabledReason !== undefined ? disabledReason : description;
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={[typography.bodyStrong, { color: disabled ? colors.textDisabled : colors.text }]}>{label}</Text>
        {caption !== undefined && <Text style={[typography.caption, { color: disabled ? colors.textDisabled : colors.textMuted }]}>{caption}</Text>}
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={caption}
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: colors.controlTrack, true: colors.accent }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: touchTargets.minimum + 8, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  text: { flex: 1, gap: spacing.xxs },
});
