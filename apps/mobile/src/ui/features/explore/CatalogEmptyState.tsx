import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAppServices } from '@/composition/AppServicesContext';
import { useCatalogStore } from '@/modules/catalog/catalogStore';
import { COPY } from '../../copy';
import { EmptyState } from '../../primitives/States';
import { retryCatalogSync } from '../../retryCatalogSync';
import { colors, spacing, typography } from '../../theme/tokens';

// Shows what a list screen holds when the catalog has no parks: loading, or the Home empty copy with a retry.
export function CatalogEmptyState()
{
  const services = useAppServices();
  const status = useCatalogStore((state) => state.status);

  if (status === 'loading')
  {
    return (
      <View testID="catalog-loading" style={styles.loading} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.primary} />
        <Text style={[typography.body, { color: colors.textMuted }]}>{COPY.catalogLoading}</Text>
      </View>
    );
  }

  return (
    <EmptyState
      testID="empty-catalog"
      icon="cloud-off-outline"
      title={COPY.emptyCatalogTitle}
      message={COPY.emptyCatalogMessage}
      actionLabel={COPY.emptyCatalogRetry}
      onAction={() => retryCatalogSync(services.catalogSync)}
    />
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.lg },
});
