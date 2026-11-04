import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, type ViewStyle } from 'react-native';

interface KeyboardAvoidingScreenProps {
  children: ReactNode;
  style?: ViewStyle;
  /** Only needed when something fixed (a custom header, a banner) sits above the scrollable content inside this wrapper — native-stack's own header is outside it and needs no offset. */
  keyboardVerticalOffset?: number;
}

/**
 * The one place a screen gets keyboard-avoidance from, instead of repeating the
 * platform-specific KeyboardAvoidingView boilerplate per screen (which only 4 of the
 * ~19 screens with a TextInput had, leaving the keyboard to overlay the active field on
 * every other one). Wrap a screen's existing root content — ScrollView, FlatList,
 * whatever — in this.
 */
export function KeyboardAvoidingScreen({ children, style, keyboardVerticalOffset = 0 }: KeyboardAvoidingScreenProps) {
  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
