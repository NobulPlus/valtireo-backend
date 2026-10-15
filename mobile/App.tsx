import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { queryClient } from './src/lib/queryClient';
import { loadStoredToken } from './src/lib/secureToken';
import { AuthProvider } from './src/context/AuthContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { QueryError } from './src/components/QueryError';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/theme';

function AppContent() {
  const { scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppRoot />
    </ErrorBoundary>
  );
}

function AppRoot() {
  // The axios interceptor needs a synchronous token read, so we wait for the
  // one-time secure-store load to resolve before rendering anything that
  // might call the API (see src/lib/secureToken.ts).
  const [tokenLoaded, setTokenLoaded] = useState(false);

  const [storageError, setStorageError] = useState(false);
  const loadToken = useCallback(async () => {
    setStorageError(false);
    try { await loadStoredToken(); setTokenLoaded(true); }
    catch { setStorageError(true); }
  }, []);
  useEffect(() => {
    let mounted = true;
    loadStoredToken().then(() => { if (mounted) setTokenLoaded(true); })
      .catch(() => { if (mounted) setStorageError(true); });
    return () => { mounted = false; };
  }, []);
  if (storageError) {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryError message="Unable to access secure storage. Unlock your device and try again." retry={loadToken} />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  if (!tokenLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
