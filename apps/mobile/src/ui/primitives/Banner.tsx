import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '../theme/tokens';
import { TextButton } from './Buttons';
import { Icon, type IconName } from './Icon';

export interface BannerAction
{
  label: string;
  onPress: () => void;
}

export function Banner({ icon, message, tone = 'warning', actions = [], testID }: { icon: IconName; message: string; tone?: 'warning' | 'info'; actions?: BannerAction[]; testID?: string })
{
  const accent = tone === 'warning' ? colors.warning : colors.info;
  const surface = tone === 'warning' ? colors.warningSurface : colors.surface;
  return (
    <View testID={testID} style={[styles.banner, { borderLeftColor: accent, backgroundColor: surface }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Icon name={icon} size={20} color={accent} />
      <Text style={[typography.caption, styles.message]}>{message}</Text>
      {actions.map((action) => <TextButton key={action.label} label={action.label} onPress={action.onPress} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderLeftWidth: 4,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    ...shadows.card,
  },
  message: { flex: 1, color: colors.text, paddingVertical: spacing.md },
});
