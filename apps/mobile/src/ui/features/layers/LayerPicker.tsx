import { useCallback, useEffect, useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import type { MapLayerSettings } from '../../map/mapTypes';
import { Chip } from '../../primitives/Chip';
import { projectMomentum, rubberband } from '../../primitives/motion';
import { Toggle } from '../../primitives/Toggle';
import { colors, radii, shadows, spacing, typography } from '../../theme/tokens';

export interface LayerPickerProps
{
  visible: boolean;
  layers: MapLayerSettings;
  satelliteAvailable: boolean;
  onChange: (layers: Partial<MapLayerSettings>) => void;
  onClose: () => void;
}

const OPEN_SPRING = { duration: 300, dampingRatio: 1 } as const;
const SNAP_BACK_SPRING = { duration: 300, dampingRatio: 0.8 } as const;
const DISMISS_FRACTION = 0.4;
const FADE_MS = 200;

export function LayerPicker({ visible, layers, satelliteAvailable, onChange, onClose }: LayerPickerProps)
{
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(windowHeight);
  const sheetHeight = useSharedValue(windowHeight);
  const sheetOpacity = useSharedValue(1);
  const dragStart = useSharedValue(0);

  useEffect(() =>
  {
    if (!visible)
    {
      return;
    }
    if (reducedMotion)
    {
      translateY.set(0);
      sheetOpacity.set(0);
      sheetOpacity.set(withTiming(1, { duration: FADE_MS }));
      return;
    }
    sheetOpacity.set(1);
    translateY.set(sheetHeight.get());
    translateY.set(withSpring(0, OPEN_SPRING));
  }, [visible, reducedMotion, translateY, sheetHeight, sheetOpacity]);

  const animateClose = useCallback((velocity: number) =>
  {
    'worklet';
    const onFinished = (finished?: boolean) =>
    {
      'worklet';
      if (finished === true)
      {
        scheduleOnRN(onClose);
      }
    };
    if (reducedMotion)
    {
      sheetOpacity.set(withTiming(0, { duration: FADE_MS }, onFinished));
      return;
    }
    translateY.set(withSpring(sheetHeight.get(), { ...OPEN_SPRING, velocity, overshootClamping: true }, onFinished));
  }, [onClose, reducedMotion, sheetHeight, sheetOpacity, translateY]);

  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onStart(() =>
    {
      dragStart.set(translateY.get());
    })
    .onUpdate((event) =>
    {
      const next = dragStart.get() + event.translationY;
      translateY.set(next >= 0 ? next : rubberband(next, sheetHeight.get()));
    })
    .onEnd((event) =>
    {
      const projected = translateY.get() + projectMomentum(event.velocityY);
      if (projected > sheetHeight.get() * DISMISS_FRACTION)
      {
        animateClose(event.velocityY);
        return;
      }
      translateY.set(withSpring(0, { ...SNAP_BACK_SPRING, velocity: event.velocityY }));
    }), [animateClose, dragStart, sheetHeight, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: sheetOpacity.get(),
    transform: [{ translateY: translateY.get() }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: sheetOpacity.get() * interpolate(translateY.get(), [0, sheetHeight.get()], [1, 0], Extrapolation.CLAMP),
  }));

  const onSheetLayout = (event: LayoutChangeEvent) =>
  {
    sheetHeight.set(event.nativeEvent.layout.height);
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={() => animateClose(0)}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.scrim, scrimStyle]}>
          <Pressable style={styles.fill} onPress={() => animateClose(0)} accessibilityLabel="Close map layers" accessibilityRole="button" />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View testID="layer-picker" onLayout={onSheetLayout} style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }, sheetStyle]}>
            <View style={styles.handle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
            <Text style={[typography.title, styles.inset, { color: colors.text }]} accessibilityRole="header">Map layers</Text>
            <View style={[styles.chips, styles.inset]}>
              <Chip testID="layer-standard" label="Standard" icon="map-outline" selected={layers.baseLayer === 'standard'} onPress={() => onChange({ baseLayer: 'standard' })} />
              {satelliteAvailable && (
                <Chip testID="layer-satellite" label="Satellite" icon="satellite-variant" selected={layers.baseLayer === 'satellite'} onPress={() => onChange({ baseLayer: 'satellite' })} />
              )}
            </View>
            <Toggle testID="layer-boundaries" label="Heritage boundaries" description="Shade the area around each heritage park" value={layers.showHeritageBoundaries} onValueChange={(value) => onChange({ showHeritageBoundaries: value })} />
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  fill: { flex: 1 },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, paddingTop: spacing.sm, gap: spacing.lg, ...shadows.sheet },
  inset: { paddingHorizontal: spacing.xl },
  chips: { flexDirection: 'row', gap: spacing.sm },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: radii.pill, backgroundColor: colors.controlTrack },
});
