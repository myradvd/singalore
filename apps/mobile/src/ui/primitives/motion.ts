import { useCallback } from 'react';
import { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);

const PRESSED_SCALE = 0.97;
const PRESS_DURATION_MS = 120;

export function usePressScale(enabled: boolean = true)
{
  const reducedMotion = useReducedMotion();
  const active = enabled && !reducedMotion;
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const onPressIn = useCallback(() =>
  {
    if (active)
    {
      scale.set(withTiming(PRESSED_SCALE, { duration: PRESS_DURATION_MS, easing: EASE_OUT }));
    }
  }, [active, scale]);
  const onPressOut = useCallback(() =>
  {
    if (active)
    {
      scale.set(withTiming(1, { duration: PRESS_DURATION_MS, easing: EASE_OUT }));
    }
  }, [active, scale]);
  return { animatedStyle, onPressIn, onPressOut };
}

// Where a flick would come to rest if it kept decelerating (exponential decay, as UIScrollView does).
export function projectMomentum(velocityPerSecond: number, decelerationRate: number = 0.998): number
{
  'worklet';
  return ((velocityPerSecond / 1000) * decelerationRate) / (1 - decelerationRate);
}

export function rubberband(overshoot: number, dimension: number, constant: number = 0.55): number
{
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
