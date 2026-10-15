import Svg, { Circle } from 'react-native-svg';
import type { StyleProp, ViewStyle } from 'react-native';

interface GeometricAccentProps {
  size: number;
  color: string;
  opacity: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A solid, soft-toned decorative circle — the one geometric brand accent used on
 * Login/Home per docs/design-system/03-component-specifications.md ("GeometricAccent").
 * Rendered behind all content, non-interactive. Replaces the retired gradient-hero/
 * grid/glow/sparkle backdrop.
 */
export function GeometricAccent({ size, color, opacity, style }: GeometricAccentProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={[{ position: 'absolute' }, style]} pointerEvents="none">
      <Circle cx={50} cy={50} r={50} fill={color} opacity={opacity} />
    </Svg>
  );
}
