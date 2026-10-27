import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LifestyleScreen } from '../screens/LifestyleScreen';
import { SendAppreciationScreen } from '../screens/SendAppreciationScreen';
import { LifestylePreferencesScreen } from '../screens/LifestylePreferencesScreen';
import { navigatorScreenOptions, useTheme } from '../theme';

export type LifestyleStackParamList = {
  LifestyleHome: undefined;
  /** Optional pre-filled recipient — set when reached via a deep link (e.g. Home's
   * milestone row) that already knows who this is for, so the form doesn't make the
   * person search from scratch for someone they just tapped. */
  SendAppreciation: { recipientEmployeeId: number; recipientName: string } | undefined;
  LifestylePreferences: undefined;
};

const Stack = createNativeStackNavigator<LifestyleStackParamList>();

export function LifestyleStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator screenOptions={navigatorScreenOptions(colors)}>
      <Stack.Screen name="LifestyleHome" component={LifestyleScreen} options={{ title: 'Lifestyle' }} />
      <Stack.Screen name="SendAppreciation" component={SendAppreciationScreen} options={{ title: 'Send appreciation' }} />
      <Stack.Screen name="LifestylePreferences" component={LifestylePreferencesScreen} options={{ title: 'Preferences' }} />
    </Stack.Navigator>
  );
}
