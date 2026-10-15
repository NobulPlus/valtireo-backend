import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AttendanceListScreen } from '../screens/AttendanceListScreen';
import { RequestCorrectionScreen } from '../screens/RequestCorrectionScreen';
import { navigatorScreenOptions, useTheme } from '../theme';
import type { AttendanceRecord } from '../types/api';

export type AttendanceStackParamList = {
  AttendanceList: undefined;
  RequestCorrection: { record: AttendanceRecord };
};

const Stack = createNativeStackNavigator<AttendanceStackParamList>();

export function AttendanceStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator screenOptions={navigatorScreenOptions(colors)}>
      <Stack.Screen name="AttendanceList" component={AttendanceListScreen} options={{ title: 'Attendance' }} />
      <Stack.Screen name="RequestCorrection" component={RequestCorrectionScreen} options={{ title: 'Request correction' }} />
    </Stack.Navigator>
  );
}
