import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useV2Colors } from '../theme';

interface IconSpec {
  name: keyof typeof Ionicons.glyphMap;
  top: `${number}%`;
  left: `${number}%`;
  size: number;
  opacity: number;
  /** Apricot instead of ink — reserved for the 2-3 icons meant to read as a deliberate "pop," not the general texture. */
  accent?: boolean;
}

/**
 * Design System v2's background treatment for every screen except Home (Home keeps
 * its own soft-blob DecorativeAccents) — confirmed on the design canvas
 * ("Background — product icon field"). A sparse field of small outline icons, each
 * standing for an actual part of the product, instead of an abstract shape: mostly
 * very low opacity so they read as texture at a glance, with a few lifted into
 * `accentApricot` at moderate opacity for genuine "pop" moments. Positions are
 * percentages of the host screen's own size (not fixed pixels), so the field scales
 * across phone sizes the same way GeometricAccent's corner blobs do.
 */
const ICONS: IconSpec[] = [
  { name: 'document-text-outline', top: '1.5%', left: '77%', size: 26, opacity: 0.26, accent: true },
  { name: 'calendar-outline', top: '16%', left: '-1%', size: 18, opacity: 0.08 },
  { name: 'time-outline', top: '22%', left: '92%', size: 20, opacity: 0.14 },
  { name: 'cash-outline', top: '35%', left: '0%', size: 17, opacity: 0.08 },
  { name: 'chatbubbles-outline', top: '40%', left: '93%', size: 19, opacity: 0.08 },
  { name: 'checkmark-circle-outline', top: '63%', left: '12%', size: 24, opacity: 0.1 },
  { name: 'people-outline', top: '69%', left: '66%', size: 18, opacity: 0.08 },
  { name: 'laptop-outline', top: '76%', left: '33%', size: 20, opacity: 0.07 },
  { name: 'heart-outline', top: '82%', left: '79%', size: 19, opacity: 0.24, accent: true },
  { name: 'bar-chart-outline', top: '87%', left: '12%', size: 16, opacity: 0.08 },
  { name: 'briefcase-outline', top: '4%', left: '5%', size: 15, opacity: 0.07 },
  { name: 'ticket-outline', top: '50%', left: '4%', size: 20, opacity: 0.09 },
  { name: 'call-outline', top: '50%', left: '86%', size: 18, opacity: 0.09 },
  { name: 'notifications-outline', top: '4%', left: '45%', size: 14, opacity: 0.07 },
  { name: 'sparkles', top: '63%', left: '57%', size: 16, opacity: 0.3, accent: true },
];

export function ProductIconField() {
  const v2 = useV2Colors();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {ICONS.map((icon, index) => (
        <Ionicons
          key={index}
          name={icon.name}
          size={icon.size}
          color={icon.accent ? v2.accentApricot : v2.ink}
          style={{ position: 'absolute', top: icon.top, left: icon.left, opacity: icon.opacity }}
        />
      ))}
    </View>
  );
}
