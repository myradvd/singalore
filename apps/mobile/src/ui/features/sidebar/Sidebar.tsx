import { APP_NAME } from '@singalore/shared';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { IconName } from '../../primitives/Icon';
import { IconButton } from '../../primitives/IconButton';
import { ListRow } from '../../primitives/ListRow';
import { colors, fill, radii, shadows, spacing, typography } from '../../theme/tokens';

export interface SidebarItem
{
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
  badge?: string;
}

export interface SidebarProps
{
  primary: SidebarItem[];
  secondary: SidebarItem[];
  footer: SidebarItem[];
  onClose: () => void;
}

export function Sidebar({ primary, secondary, footer, onClose }: SidebarProps)
{
  const insets = useSafeAreaInsets();
  const renderItem = (item: SidebarItem) => (
    <ListRow
      key={item.key}
      testID={`sidebar-${item.key}`}
      title={item.label}
      icon={item.icon}
      onPress={item.onPress}
      trailing={item.badge === undefined ? undefined : <Text style={[typography.captionStrong, styles.badge]}>{item.badge}</Text>}
    />
  );
  return (
    <View testID="sidebar" style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Pressable accessibilityLabel="Close menu" accessibilityRole="button" onPress={onClose} style={styles.scrim} />
      <View style={[styles.panel, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.titleRow}>
          <Text style={[typography.wordmark, { color: colors.text }]}>{APP_NAME}</Text>
          <IconButton testID="close-sidebar" icon="close" accessibilityLabel="Close menu" onPress={onClose} />
        </View>
        <ScrollView>
          <Text style={[typography.eyebrow, styles.section]}>EXPLORE</Text>
          {primary.map(renderItem)}
          {secondary.length > 0 && <View style={styles.divider} />}
          {secondary.map(renderItem)}
        </ScrollView>
        {footer.length > 0 && <View style={styles.footer}>{footer.map(renderItem)}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...fill, backgroundColor: colors.scrim },
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '82%', maxWidth: 360, backgroundColor: colors.background, borderTopRightRadius: radii.xl, borderBottomRightRadius: radii.xl, ...shadows.drawer },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: spacing.xl, paddingRight: spacing.sm, paddingBottom: spacing.lg },
  section: { color: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.md, marginHorizontal: spacing.xl },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  badge: { color: colors.onAccent, backgroundColor: colors.accent, borderRadius: radii.pill, paddingHorizontal: spacing.sm, overflow: 'hidden' },
});
