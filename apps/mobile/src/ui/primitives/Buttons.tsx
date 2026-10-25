import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { colors, radii, shadows, spacing, touchTargets, typography } from '../theme/tokens';
import { Icon, type IconName } from './Icon';
import { usePressScale } from './motion';

export interface ButtonProps
{
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  pressScale?: boolean;
}

const PRESS_RETENTION = { top: 16, bottom: 16, left: 16, right: 16 };

export function PrimaryButton({ label, onPress, icon, disabled = false, loading = false, accessibilityHint, style, testID, pressScale = false }: ButtonProps)
{
  const inactive = disabled || loading;
  const press = usePressScale(pressScale);
  const button = (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      pressRetentionOffset={PRESS_RETENTION}
      style={({ pressed }) => [styles.base, styles.primary, pressed && styles.primaryPressed, inactive && styles.inactive, style]}
    >
      {loading ? <ActivityIndicator color={colors.onAccent} /> : (
        <View style={styles.content}>
          {icon !== undefined && <Icon name={icon} size={20} color={colors.onAccent} />}
          <Text style={[styles.label, { color: colors.onAccent }]} maxFontSizeMultiplier={1.6}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
  return pressScale ? <Animated.View style={press.animatedStyle}>{button}</Animated.View> : button;
}

export function SecondaryButton({ label, onPress, icon, disabled = false, accessibilityHint, style, testID, tone = 'default', pressScale = false }: ButtonProps & { tone?: 'default' | 'danger' })
{
  const press = usePressScale(pressScale);
  const textColor = disabled ? colors.textDisabled : tone === 'danger' ? colors.danger : colors.text;
  const button = (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      pressRetentionOffset={PRESS_RETENTION}
      style={({ pressed }) => [styles.base, styles.secondary, pressed && styles.pressed, style]}
    >
      <View style={styles.content}>
        {icon !== undefined && <Icon name={icon} size={20} color={textColor} />}
        <Text style={[styles.label, { color: textColor }]} maxFontSizeMultiplier={1.6}>{label}</Text>
      </View>
    </Pressable>
  );
  return pressScale ? <Animated.View style={press.animatedStyle}>{button}</Animated.View> : button;
}

export function TextButton({ label, onPress, disabled = false, style, testID }: ButtonProps)
{
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.text, pressed && styles.pressed, style]}
    >
      <Text style={[typography.label, { color: disabled ? colors.textDisabled : colors.primary }]} maxFontSizeMultiplier={1.6}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: touchTargets.minimum, borderRadius: radii.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: colors.accent, ...shadows.card },
  primaryPressed: { backgroundColor: colors.accentPressed },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  inactive: { opacity: 0.5 },
  pressed: { backgroundColor: colors.surfaceSunken },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: typography.label,
  text: { minHeight: touchTargets.minimum, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radii.sm },
});
