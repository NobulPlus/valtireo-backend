import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AssetsListScreen } from '../screens/AssetsListScreen';
import { ReportFaultScreen } from '../screens/ReportFaultScreen';
import { navigatorScreenOptions, useTheme } from '../theme';

export type AssetsStackParamList = {
  AssetsList: undefined;
  ReportFault: { assetId: number; assetName: string };
};

const Stack = createNativeStackNavigator<AssetsStackParamList>();

export function AssetsStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator screenOptions={navigatorScreenOptions(colors)}>
      <Stack.Screen name="AssetsList" component={AssetsListScreen} options={{ title: 'My assets' }} />
      <Stack.Screen name="ReportFault" component={ReportFaultScreen} options={{ title: 'Report a fault' }} />
    </Stack.Navigator>
  );
}
