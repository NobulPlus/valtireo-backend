import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PayslipsListScreen } from '../screens/PayslipsListScreen';
import { PayslipDetailScreen } from '../screens/PayslipDetailScreen';
import { navigatorScreenOptions, useTheme } from '../theme';

export type PayslipsStackParamList = {
  PayslipsList: undefined;
  PayslipDetail: { runItemId: number };
};

const Stack = createNativeStackNavigator<PayslipsStackParamList>();

export function PayslipsStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator screenOptions={navigatorScreenOptions(colors)}>
      <Stack.Screen name="PayslipsList" component={PayslipsListScreen} options={{ title: 'Payslips' }} />
      <Stack.Screen name="PayslipDetail" component={PayslipDetailScreen} options={{ title: 'Payslip' }} />
    </Stack.Navigator>
  );
}
