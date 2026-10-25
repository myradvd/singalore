import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../../primitives/IconButton';
import { colors, shadows, spacing, typography } from '../../theme/tokens';

export interface ScreenScaffoldProps
{
  title: string;
  onBack: () => void;
  children: ReactNode;
  testID?: string;
  headerRight?: ReactNode;
  footer?: ReactNode;
}

export function ScreenScaffold({ title, onBack, children, testID, headerRight, footer }: ScreenScaffoldProps)
{
  const insets = useSafeAreaInsets();
  return (
    <View testID={testID} style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <IconButton testID="screen-back" icon="arrow-left" accessibilityLabel="Back" onPress={onBack} variant="plain" />
        <Text style={[typography.title, styles.title]} accessibilityRole="header">{title}</Text>
        {headerRight}
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        {children}
      </ScrollView>
      {footer !== undefined && <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>{footer}</View>}
    </View>
  );
}

export function SectionTitle({ label }: { label: string })
{
  return <Text style={[typography.eyebrow, styles.section]}>{label.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title: { color: colors.text, flex: 1 },
  section: { color: colors.primary, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.sm },
  footer: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, backgroundColor: colors.surface, ...shadows.sheet },
});
