import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * The app-wide safety net — wraps everything, including ThemeProvider, so it
 * must not depend on useTheme() (that context may be exactly what crashed).
 * Colors are the same literal brand values theme.tsx's light palette uses,
 * just not read through the hook.
 */
const COLORS = { paper: '#f3f4ef', ink: '#173e38', muted: '#60716b', pine: '#123f3a', line: '#e7eae4' };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.flex}>
          <View style={styles.container}>
            <View style={styles.iconWrap}>
              <Ionicons name="alert-circle-outline" size={32} color={COLORS.pine} />
            </View>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>This screen ran into an unexpected error. Trying again usually fixes it.</Text>
            <Pressable style={styles.button} onPress={this.handleRetry} accessibilityRole="button">
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.paper },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.ink, textAlign: 'center' },
  message: { fontSize: 14, color: COLORS.muted, textAlign: 'center', maxWidth: 280 },
  button: { backgroundColor: COLORS.pine, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 28, marginTop: 8 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
