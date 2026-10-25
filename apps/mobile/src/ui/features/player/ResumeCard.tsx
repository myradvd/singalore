import { formatClock } from '@singalore/shared';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../primitives/Buttons';
import { Card } from '../../primitives/Card';
import { colors, spacing, typography } from '../../theme/tokens';

export function ResumeCard({ title, landmarkName, positionMs, onResume, onDismiss }: { title: string; landmarkName: string; positionMs: number; onResume: () => void; onDismiss: () => void })
{
  return (
    <Card testID="resume-card" style={styles.card}>
      <Text style={[typography.eyebrow, { color: colors.primary }]}>CONTINUE LISTENING?</Text>
      <Text style={[typography.heading, { color: colors.text }]}>{title}</Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{`${landmarkName}  ·  stopped at ${formatClock(positionMs / 1000)}`}</Text>
      <View style={styles.actions}>
        <PrimaryButton testID="resume-play" label="Resume" icon="play" onPress={onResume} style={styles.action} />
        <SecondaryButton testID="resume-dismiss" label="Ignore" onPress={onDismiss} style={styles.action} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  action: { flex: 1 },
});
