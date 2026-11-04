import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MoreMenuScreen } from '../screens/MoreMenuScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { DirectoryScreen } from '../screens/DirectoryScreen';
import { DocumentsStack } from './DocumentsStack';
import { PayslipsStack } from './PayslipsStack';
import { AssetsStack } from './AssetsStack';
import { LifestyleStack, type LifestyleStackParamList } from './LifestyleStack';
import { ConnectStack, type ConnectStackParamList } from './ConnectStack';
import { OrbitStack, type OrbitStackParamList } from './OrbitStack';
import { navigatorScreenOptions, useTheme } from '../theme';

export type MoreStackParamList = {
  MoreMenu: undefined;
  Documents: undefined;
  Payslips: undefined;
  Assets: undefined;
  Directory: undefined;
  Calendar: undefined;
  /** `LifestyleStack` is mounted as this screen's own component, so a caller that needs
   * to land on a specific screen inside it (not just LifestyleStack's own default)
   * passes that screen's name/params through here, standard React Navigation
   * nested-navigator convention. */
  Lifestyle: { screen: 'SendAppreciation'; params: LifestyleStackParamList['SendAppreciation'] } | undefined;
  /** Same nested-navigator convention as `Lifestyle` above — a notification deep link
   * lands straight on a specific conversation instead of the Connect list. */
  Connect: { screen: 'ConnectConversation'; params: ConnectStackParamList['ConnectConversation'] } | undefined;
  /** Same nested-navigator convention as `Lifestyle`/`Connect` above — a notification
   * deep link lands straight on a specific work item instead of the My Work list. */
  Orbit: { screen: 'OrbitWorkItemDetail'; params: OrbitStackParamList['OrbitWorkItemDetail'] } | undefined;
};

const Stack = createNativeStackNavigator<MoreStackParamList>();

export function MoreStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator screenOptions={navigatorScreenOptions(colors)}>
      {/* MoreMenuScreen now builds its own v2-styled "More" heading in-screen —
          the native header (legacy-themed, via navigatorScreenOptions above)
          would duplicate it and clash visually, same reason Documents/Payslips/
          Assets/Lifestyle below hide theirs. */}
      <Stack.Screen name="MoreMenu" component={MoreMenuScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Documents" component={DocumentsStack} options={{ headerShown: false }} />
      <Stack.Screen name="Payslips" component={PayslipsStack} options={{ headerShown: false }} />
      <Stack.Screen name="Assets" component={AssetsStack} options={{ headerShown: false }} />
      <Stack.Screen name="Directory" component={DirectoryScreen} options={{ title: 'Directory' }} />
      <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />
      <Stack.Screen name="Lifestyle" component={LifestyleStack} options={{ headerShown: false }} />
      <Stack.Screen name="Connect" component={ConnectStack} options={{ headerShown: false }} />
      <Stack.Screen name="Orbit" component={OrbitStack} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
