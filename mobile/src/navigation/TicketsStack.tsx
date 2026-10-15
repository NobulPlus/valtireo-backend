import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TicketsListScreen } from '../screens/TicketsListScreen';
import { NewTicketScreen } from '../screens/NewTicketScreen';
import { TicketDetailScreen } from '../screens/TicketDetailScreen';
import { navigatorScreenOptions, useTheme } from '../theme';

export type TicketsStackParamList = {
  TicketsList: undefined;
  NewTicket: undefined;
  TicketDetail: { ticketId: number };
};

const Stack = createNativeStackNavigator<TicketsStackParamList>();

export function TicketsStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator screenOptions={navigatorScreenOptions(colors)}>
      <Stack.Screen name="TicketsList" component={TicketsListScreen} options={{ title: 'Tickets' }} />
      <Stack.Screen name="NewTicket" component={NewTicketScreen} options={{ title: 'New ticket' }} />
      <Stack.Screen name="TicketDetail" component={TicketDetailScreen} options={{ title: 'Ticket' }} />
    </Stack.Navigator>
  );
}
