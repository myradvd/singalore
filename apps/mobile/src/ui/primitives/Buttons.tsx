import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
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
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  pressScale?: boolean;
}

const PRESS_RETENTION = { top: 16, bottom: 16, left: 16, right: 16 };

interface PillVariant
{
  surface: StyleProp<ViewStyle>;
  pressedSurface: StyleProp<ViewStyle>;
  disabledSurface?: StyleProp<ViewStyle>;
  contentColor: string;
}

// Renders the pill shaped pressable shared by the primary and secondary buttons, in the given colours.
function PillButton({ label, onPress, icon, disabled = false, accessibilityHint, style, testID, pressScale = false, variant }: ButtonProps & { variant: PillVariant })
{
  const press = usePressScale(pressScale);
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
      style={({ pressed }) => [styles.base, variant.surface, pressed && variant.pressedSurface, disabled && variant.disabledSurface, style]}
    >
      <View style={styles.content}>
        {icon !== undefined && <Icon name={icon} size={20} color={variant.contentColor} />}
        <Text style={[styles.label, { color: variant.contentColor }]} maxFontSizeMultiplier={1.6}>{label}</Text>
      </View>
    </Pressable>
  );
  return pressScale ? <Animated.View style={press.animatedStyle}>{button}</Animated.View> : button;
}

export function PrimaryButton(props: ButtonProps)
{
  return <PillButton {...props} variant={{ surface: styles.primary, pressedSurface: styles.primaryPressed, disabledSurface: styles.inactive, contentColor: colors.onAccent }} />;
}

export function SecondaryButton({ tone = 'default', ...props }: ButtonProps & { tone?: 'default' | 'danger' })
{
  const contentColor = props.disabled === true ? colors.textDisabled : tone === 'danger' ? colors.danger : colors.text;
  return <PillButton {...props} variant={{ surface: styles.secondary, pressedSurface: styles.pressed, contentColor }} />;
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
      <Text style={[styles.textLabel, { color: disabled ? colors.textDisabled : colors.primary }]} maxFontSizeMultiplier={1.6}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: touchTargets.minimum, maxWidth: '100%', borderRadius: radii.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: colors.accent, ...shadows.card },
  primaryPressed: { backgroundColor: colors.accentPressed },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  inactive: { opacity: 0.5 },
  pressed: { backgroundColor: colors.surfaceSunken },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1, maxWidth: '100%' },
  label: { ...typography.label, flexShrink: 1, textAlign: 'center' },
  textLabel: { ...typography.label, flexShrink: 1 },
  text: { minHeight: touchTargets.minimum, maxWidth: '100%', justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radii.sm },
});
