import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MoreMenuScreen } from '../screens/MoreMenuScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { DirectoryScreen } from '../screens/DirectoryScreen';
import { DocumentsStack } from './DocumentsStack';
import { PayslipsStack } from './PayslipsStack';
import { AssetsStack } from './AssetsStack';
import { LifestyleStack } from './LifestyleStack';
import { navigatorScreenOptions, useTheme } from '../theme';

export type MoreStackParamList = {
  MoreMenu: undefined;
  Documents: undefined;
  Payslips: undefined;
  Assets: undefined;
  Directory: undefined;
  Calendar: undefined;
  Lifestyle: undefined;
};

const Stack = createNativeStackNavigator<MoreStackParamList>();

export function MoreStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator screenOptions={navigatorScreenOptions(colors)}>
      <Stack.Screen name="MoreMenu" component={MoreMenuScreen} options={{ title: 'More' }} />
      <Stack.Screen name="Documents" component={DocumentsStack} options={{ headerShown: false }} />
      <Stack.Screen name="Payslips" component={PayslipsStack} options={{ headerShown: false }} />
      <Stack.Screen name="Assets" component={AssetsStack} options={{ headerShown: false }} />
      <Stack.Screen name="Directory" component={DirectoryScreen} options={{ title: 'Directory' }} />
      <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />
      <Stack.Screen name="Lifestyle" component={LifestyleStack} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
