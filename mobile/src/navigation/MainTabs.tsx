import { Platform } from 'react-native';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { HomeStack } from './HomeStack';
import { LeaveStack } from './LeaveStack';
import { AttendanceStack } from './AttendanceStack';
import { TicketsStack } from './TicketsStack';
import { MoreStack, type MoreStackParamList } from './MoreStack';
import { useAuth } from '../context/AuthContext';
import { radius, shadow, useTheme } from '../theme';

/**
 * Alerts and Directory are reachable from the Home header (bell + people icon
 * next to the avatar), not as tabs here — a hidden tabBarButton still reserves
 * its flex slot and leaves a blank gap in the bar, so those routes live inside
 * HomeStack/MoreStack instead of being registered as tabs at all.
 */
export type MainTabParamList = {
  HomeTab: undefined;
  LeaveTab: undefined;
  AttendanceTab: undefined;
  TicketsTab: undefined;
  MoreTab: NavigatorScreenParams<MoreStackParamList> | undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  HomeTab: { active: 'home', inactive: 'home-outline' },
  LeaveTab: { active: 'calendar', inactive: 'calendar-outline' },
  AttendanceTab: { active: 'time', inactive: 'time-outline' },
  TicketsTab: { active: 'ticket', inactive: 'ticket-outline' },
  MoreTab: { active: 'grid', inactive: 'grid-outline' },
};

export function MainTabs() {
  const { moduleByKey } = useAuth();
  const { colors } = useTheme();
  // A hidden tabBarButton still reserves its flex slot (see the comment above) —
  // an unsubscribed module's tab must not be registered at all, not just hidden.
  const showLeave = moduleByKey('leave')?.can_access === true;
  const showAttendance = moduleByKey('attendance')?.can_access === true;
  const showTickets = moduleByKey('service_desk')?.can_access === true;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.pine,
        tabBarInactiveTintColor: colors.muted,
        tabBarIcon: ({ focused, size }) => (
          <Ionicons name={focused ? ICONS[route.name as keyof MainTabParamList].active : ICONS[route.name as keyof MainTabParamList].inactive} size={size} color={focused ? colors.pine : colors.muted} />
        ),
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: 0,
          height: Platform.select({ ios: 84, default: 64 }),
          paddingTop: 8,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          ...shadow.soft,
        },
        tabBarItemStyle: { borderRadius: radius.md },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: 'Home' }} />
      {showLeave ? <Tab.Screen name="LeaveTab" component={LeaveStack} options={{ title: 'Leave' }} /> : null}
      {showAttendance ? <Tab.Screen name="AttendanceTab" component={AttendanceStack} options={{ title: 'Attendance' }} /> : null}
      {showTickets ? <Tab.Screen name="TicketsTab" component={TicketsStack} options={{ title: 'Tickets' }} /> : null}
      <Tab.Screen name="MoreTab" component={MoreStack} options={{ title: 'More' }} />
    </Tab.Navigator>
  );
}
