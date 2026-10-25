import { APP_NAME } from '@singalore/shared';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconButton } from '../../primitives/IconButton';
import { colors, spacing, typography } from '../../theme/tokens';

export interface HomeHeaderProps
{
  onMenuPress: () => void;
  onWordmarkPress: () => void;
  trailing?: ReactNode;
}

export function HomeHeader({ onMenuPress, onWordmarkPress, trailing }: HomeHeaderProps)
{
  return (
    <View style={styles.header}>
      <IconButton testID="open-sidebar" icon="menu" accessibilityLabel="Open menu" onPress={onMenuPress} variant="plain" />
      <Pressable onPress={onWordmarkPress} accessibilityRole="header" accessibilityLabel={APP_NAME} style={styles.wordmark}>
        <Text style={[typography.wordmark, { color: colors.text }]} maxFontSizeMultiplier={1.3}>{APP_NAME}</Text>
      </Pressable>
      <View style={styles.trailing}>{trailing}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm },
  wordmark: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md },
  trailing: { minWidth: 48, alignItems: 'flex-end' },
});
