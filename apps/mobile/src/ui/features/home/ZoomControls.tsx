import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { selectionTick } from '../../haptics';
import { Icon } from '../../primitives/Icon';
import { usePressScale } from '../../primitives/motion';
import { colors, shadows, touchTargets } from '../../theme/tokens';

export const ZOOM_CONTROLS_HEIGHT = touchTargets.minimum * 2 + StyleSheet.hairlineWidth;

export interface ZoomControlsProps
{
  onZoomIn: () => void;
  onZoomOut: () => void;
}

function ZoomButton({ icon, label, onPress, testID }: { icon: 'plus' | 'minus'; label: string; onPress: () => void; testID: string })
{
  const press = usePressScale();
  const onZoomPress = () =>
  {
    selectionTick();
    onPress();
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onZoomPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      hitSlop={{ left: 4, right: 4 }}
      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Animated.View style={press.animatedStyle}>
        <Icon name={icon} size={24} color={colors.text} />
      </Animated.View>
    </Pressable>
  );
}

export function ZoomControls({ onZoomIn, onZoomOut }: ZoomControlsProps)
{
  return (
    <View testID="zoom-controls" style={styles.group}>
      <ZoomButton testID="zoom-in" icon="plus" label="Zoom in" onPress={onZoomIn} />
      <View style={styles.divider} />
      <ZoomButton testID="zoom-out" icon="minus" label="Zoom out" onPress={onZoomOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    width: touchTargets.minimum,
    borderRadius: touchTargets.minimum / 2,
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.floating,
  },
  button: { width: touchTargets.minimum, height: touchTargets.minimum, borderRadius: touchTargets.minimum / 2, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.surfaceSunken },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 8 },
});
