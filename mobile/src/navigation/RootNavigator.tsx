import { ActivityIndicator, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer, type NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { ReconnectScreen } from '../screens/ReconnectScreen';
import { MainTabs, type MainTabParamList } from './MainTabs';
import { useTheme } from '../theme';
import { navigationRef } from './navigationRef';
import { usePushNotifications } from '../lib/pushNotifications';

export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  Reconnect: undefined;
  // Widened from `undefined` so a tapped push notification (see navigationRef.ts)
  // can deep-link straight into a MainTabs-nested screen from outside the
  // component tree, the same nested-navigate shape MoreStack/HomeAreaNavigation
  // already use for in-screen deep links.
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isLoading, isAuthenticated, reconnectError } = useAuth();
  const { colors, scheme } = useTheme();
  usePushNotifications(isAuthenticated);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator size="large" color={colors.pine} />
      </View>
    );
  }

  const navigationTheme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.pine,
      background: colors.paper,
      card: colors.white,
      text: colors.ink,
      border: colors.line,
      notification: colors.danger,
    },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : reconnectError ? (
          <Stack.Screen name="Reconnect" component={ReconnectScreen} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
