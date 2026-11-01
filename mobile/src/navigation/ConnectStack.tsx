import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ConnectListScreen, ConnectListHeaderButtons } from '../screens/ConnectListScreen';
import { NewConversationScreen } from '../screens/NewConversationScreen';
import { ConnectConversationScreen } from '../screens/ConnectConversationScreen';
import { ConnectMembersScreen } from '../screens/ConnectMembersScreen';
import { ConnectPreferencesScreen } from '../screens/ConnectPreferencesScreen';
import { ConnectReportsScreen } from '../screens/ConnectReportsScreen';
import { ConnectCallsScreen } from '../screens/ConnectCallsScreen';
import { navigatorScreenOptions, useTheme } from '../theme';

export type ConnectStackParamList = {
  ConnectList: undefined;
  NewConversation: undefined;
  ConnectConversation: { conversationId: string };
  ConnectMembers: { conversationId: string };
  ConnectPreferences: undefined;
  ConnectReports: undefined;
  ConnectCalls: undefined;
};

const Stack = createNativeStackNavigator<ConnectStackParamList>();

export function ConnectStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator screenOptions={navigatorScreenOptions(colors)}>
      <Stack.Screen
        name="ConnectList"
        component={ConnectListScreen}
        options={({ navigation }) => ({ title: 'Connect', headerRight: () => <ConnectListHeaderButtons navigation={navigation} /> })}
      />
      <Stack.Screen name="NewConversation" component={NewConversationScreen} options={{ title: 'New conversation' }} />
      <Stack.Screen name="ConnectConversation" component={ConnectConversationScreen} options={{ title: 'Conversation' }} />
      <Stack.Screen name="ConnectMembers" component={ConnectMembersScreen} options={{ title: 'Members' }} />
      <Stack.Screen name="ConnectPreferences" component={ConnectPreferencesScreen} options={{ title: 'Connect preferences' }} />
      <Stack.Screen name="ConnectReports" component={ConnectReportsScreen} options={{ title: 'Reported messages' }} />
      <Stack.Screen name="ConnectCalls" component={ConnectCallsScreen} options={{ title: 'Call history' }} />
    </Stack.Navigator>
  );
}
