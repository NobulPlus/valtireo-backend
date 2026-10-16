import { StyleSheet, View } from 'react-native';
import { GeometricAccent } from './GeometricAccent';
import { useV2Colors } from '../theme';

/**
 * Design System v2's one decorative accent treatment, shared by every v2 screen
 * (Login, Home) instead of each re-declaring it — see
 * docs/design-system/03-component-specifications.md ("GeometricAccent") and
 * 04-screen-specifications-login-home.md. Two large, soft, corner-anchored
 * blobs (apricot-dominant in light mode, teal-dominant in dark mode) plus one
 * small apricot "spark" dot that stays warm-colored in both themes. Pulled well
 * off-canvas and kept low-opacity so it never competes with foreground content
 * — see LoginScreen's real-device polish-pass notes for why these particular
 * sizes/offsets/opacities were chosen over a more intrusive first pass.
 */
export function DecorativeAccents({ scheme }: { scheme: 'light' | 'dark' }) {
  const v2 = useV2Colors();
  const largeBlobColor = scheme === 'dark' ? v2.primary : v2.accentApricot;
  const largeBlobOpacity = scheme === 'dark' ? 0.13 : 0.18;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <GeometricAccent size={190} color={largeBlobColor} opacity={largeBlobOpacity} style={{ top: -95, left: -110 }} />
      <GeometricAccent size={210} color={largeBlobColor} opacity={largeBlobOpacity} style={{ bottom: -130, right: -115 }} />
      <GeometricAccent size={26} color={v2.accentApricot} opacity={0.8} style={{ bottom: 18, left: 18 }} />
    </View>
  );
}
