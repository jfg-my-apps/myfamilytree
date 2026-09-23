import { Platform } from 'react-native';

/**
 * react-native-svg attaches its legacy responder-based touch mixin to any
 * shape/group given an `onPress` prop, which react-native-web then flags as
 * unknown DOM event handlers on every tap. The library also maps `onPress`
 * to a real `onClick` internally, so passing `onClick` directly on web skips
 * the responder mixin (and its warnings) entirely. Native still needs
 * `onPress`, since there's no DOM click event there.
 */
export function svgPressProps(onPress: () => void): {
  onPress?: () => void;
  onClick?: () => void;
} {
  return Platform.OS === 'web' ? { onClick: onPress } : { onPress };
}
