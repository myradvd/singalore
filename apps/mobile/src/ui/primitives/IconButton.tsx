import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, shadows, touchTargets } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

export interface IconButtonProps
{
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  variant?: 'glass' | 'accent' | 'primary' | 'plain' | 'danger';
  size?: 'standard' | 'player' | 'playerPrimary';
  disabled?: boolean;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const DIMENSIONS = {
  standard: touchTargets.minimum,
  player: touchTargets.player,
  playerPrimary: touchTargets.playerPrimary,
} as const;

export function IconButton({ icon, accessibilityLabel, onPress, variant = 'glass', size = 'standard', disabled = false, selected, style, testID }: IconButtonProps)
{
  const dimension = DIMENSIONS[size];
  const iconColor = variant === 'accent' ? colors.onAccent : variant === 'primary' ? colors.onPrimary : variant === 'danger' ? colors.onDanger : disabled ? colors.textDisabled : colors.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, ...(selected === undefined ? {} : { selected }) }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        { width: dimension, height: dimension, borderRadius: dimension / 2 },
        variant === 'glass' && styles.glass,
        variant === 'accent' && [styles.accent, pressed && styles.accentPressed],
        variant === 'primary' && [styles.primary, pressed && styles.primaryPressed],
        variant === 'danger' && { backgroundColor: colors.dangerSurface },
        pressed && (variant === 'glass' || variant === 'plain') && styles.pressed,
        style,
      ]}
    >
      <Icon name={icon} size={size === 'playerPrimary' ? 36 : size === 'player' ? 28 : 24} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  glass: { backgroundColor: colors.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadows.floating },
  accent: { backgroundColor: colors.accent, ...shadows.floating },
  accentPressed: { backgroundColor: colors.accentPressed },
  primary: { backgroundColor: colors.primary, ...shadows.floating },
  primaryPressed: { backgroundColor: colors.primaryPressed },
  pressed: { backgroundColor: colors.surfaceSunken },
});
