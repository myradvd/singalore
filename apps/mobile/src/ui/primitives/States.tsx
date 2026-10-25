import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';
import { PrimaryButton } from './Buttons';
import { Icon, type IconName } from './Icon';

interface StateProps
{
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

function StateView({ icon, title, message, actionLabel, onAction, testID, tone }: StateProps & { tone: 'neutral' | 'error' })
{
  return (
    <View testID={testID} style={styles.container} accessibilityLiveRegion="polite">
      <Icon name={icon} size={40} color={tone === 'error' ? colors.danger : colors.primary} />
      <Text style={[typography.title, styles.title]} accessibilityRole="header">{title}</Text>
      <Text style={[typography.body, styles.message]}>{message}</Text>
      {actionLabel !== undefined && onAction !== undefined && <PrimaryButton label={actionLabel} onPress={onAction} />}
    </View>
  );
}

export function EmptyState(props: StateProps)
{
  return <StateView {...props} tone="neutral" />;
}

export function ErrorState(props: StateProps)
{
  return <StateView {...props} tone="error" />;
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.lg },
  title: { color: colors.text, textAlign: 'center' },
  message: { color: colors.textMuted, textAlign: 'center' },
});
