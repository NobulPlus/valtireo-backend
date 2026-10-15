import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LeaveListScreen } from '../screens/LeaveListScreen';
import { NewLeaveRequestScreen } from '../screens/NewLeaveRequestScreen';
import { navigatorScreenOptions, useTheme } from '../theme';

export type LeaveStackParamList = {
  LeaveList: undefined;
  NewLeaveRequest: undefined;
};

const Stack = createNativeStackNavigator<LeaveStackParamList>();

export function LeaveStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator screenOptions={navigatorScreenOptions(colors)}>
      <Stack.Screen name="LeaveList" component={LeaveListScreen} options={{ title: 'Leave' }} />
      <Stack.Screen name="NewLeaveRequest" component={NewLeaveRequestScreen} options={{ title: 'Request leave' }} />
    </Stack.Navigator>
  );
}
