import Svg, { Path } from 'react-native-svg';
import type { StyleProp, ViewStyle } from 'react-native';

const SPARKLE_PATH = 'M12 1 L14.2 9.8 L23 12 L14.2 14.2 L12 23 L9.8 14.2 L1 12 L9.8 9.8 Z';

/** The small four-point sparkle used on hero/gradient backgrounds (Login, Home) to suggest light catching a grid. */
export function Sparkle({ size, color, opacity, style }: { size: number; color: string; opacity: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={[{ position: 'absolute' }, style]}>
      <Path d={SPARKLE_PATH} fill={color} opacity={opacity} />
    </Svg>
  );
}
