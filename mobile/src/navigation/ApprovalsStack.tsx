import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ApprovalsListScreen } from '../screens/ApprovalsListScreen';
import { ApprovalDetailScreen } from '../screens/ApprovalDetailScreen';
import { navigatorScreenOptionsV2, useV2Colors } from '../theme';

export type ApprovalsStackParamList = {
  ApprovalsList: undefined;
  ApprovalDetail: { approvalRequestId: number };
};

const Stack = createNativeStackNavigator<ApprovalsStackParamList>();

export function ApprovalsStack() {
  const v2 = useV2Colors();
  return (
    <Stack.Navigator screenOptions={navigatorScreenOptionsV2(v2)}>
      {/* ApprovalsList is this stack's tab root — it builds its own v2 title
          in-screen (same reason MoreMenuScreen hides its native header), so the
          native one here would duplicate it. ApprovalDetail is a pushed screen and
          keeps its back-button header, just reskinned onto v2 by screenOptions above. */}
      <Stack.Screen name="ApprovalsList" component={ApprovalsListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ApprovalDetail" component={ApprovalDetailScreen} options={{ title: 'Approval request' }} />
    </Stack.Navigator>
  );
}
