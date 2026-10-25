import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows, spacing, typography } from '../theme/tokens';
import { useToastStore, type ToastMessage } from '../toastStore';

const TOAST_DURATION_MS = 3500;

function ToastItem({ toast }: { toast: ToastMessage })
{
  const dismiss = useToastStore((state) => state.dismiss);
  useEffect(() =>
  {
    const timer = setTimeout(() => dismiss(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [dismiss, toast.id]);
  return (
    <View style={[styles.toast, toast.tone === 'error' && styles.error]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Text style={[typography.body, { color: colors.onInverse }]}>{toast.message}</Text>
    </View>
  );
}

export function ToastHost()
{
  const toasts = useToastStore((state) => state.toasts);
  const insets = useSafeAreaInsets();
  if (toasts.length === 0)
  {
    return null;
  }
  return (
    <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + 120 }]}>
      {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing.lg, right: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  toast: { backgroundColor: colors.inverseSurface, borderRadius: radii.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, maxWidth: 420, ...shadows.floating },
  error: { backgroundColor: colors.dangerSurface },
});
