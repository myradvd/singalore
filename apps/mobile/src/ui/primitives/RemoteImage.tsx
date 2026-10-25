import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

export interface RemoteImageProps
{
  uri: string | null;
  accessibilityLabel: string;
  style: StyleProp<ViewStyle>;
  placeholderIcon?: IconName;
  placeholderIconSize?: number;
  testID?: string;
}

export function RemoteImage({ uri, accessibilityLabel, style, placeholderIcon = 'image-filter-hdr', placeholderIconSize = 28, testID }: RemoteImageProps)
{
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (uri === null || failedUri === uri)
  {
    return (
      <View testID={testID === undefined ? undefined : `${testID}-placeholder`} style={[style, styles.placeholder]} accessibilityLabel="No photo available">
        <Icon name={placeholderIcon} size={placeholderIconSize} color={colors.textDisabled} />
      </View>
    );
  }
  return (
    <View style={[style, styles.frame]}>
      <Image
        testID={testID}
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={150}
        accessibilityLabel={accessibilityLabel}
        onError={() => setFailedUri(uri)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSunken, overflow: 'hidden' },
  frame: { backgroundColor: colors.surfaceSunken, overflow: 'hidden' },
});
