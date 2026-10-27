import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { EmergencyContactsScreen } from '../screens/EmergencyContactsScreen';
import { EmergencyContactFormScreen } from '../screens/EmergencyContactFormScreen';
import { DependentsScreen } from '../screens/DependentsScreen';
import { DependentFormScreen } from '../screens/DependentFormScreen';
import { useAuth } from '../context/AuthContext';
import { navigatorScreenOptions, useTheme } from '../theme';
import type { Dependent, EmergencyContact } from '../types/api';

export type HomeStackParamList = {
  Home: undefined;
  Profile: undefined;
  Notifications: undefined;
  EmergencyContacts: undefined;
  EmergencyContactForm: { contact?: EmergencyContact };
  Dependents: undefined;
  DependentForm: { dependent?: Dependent };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

/** The org's own short name, not the Valtireo product name — this is the employee's workspace, not an ad for the platform. Falls back to "Valtireo" only if the org hasn't set one. The logo sits here, next to the name, instead of being repeated again in the Home screen body. */
function HomeHeaderTitle() {
  const { session } = useAuth();
  const { typography } = useTheme();
  const workspace = session?.workspace;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {workspace ? <Avatar uri={workspace.identity.logo_url} name={workspace.workspace_name} size={22} /> : null}
      <Text style={typography.heading}>{workspace?.identity.short_name || 'Valtireo'}</Text>
    </View>
  );
}

function HomeHeaderRight() {
  const { colors } = useTheme();
  const { logout } = useAuth();

  function handleLogout() {
    Alert.alert('Sign out?', "You'll need to sign in again to continue.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
    ]);
  }

  return (
    <Pressable onPress={handleLogout} accessibilityLabel="Sign out" style={{ padding: 8 }}>
      <Ionicons name="log-out-outline" size={22} color={colors.danger} />
    </Pressable>
  );
}

export function HomeStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator screenOptions={navigatorScreenOptions(colors)}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerTitle: HomeHeaderTitle, headerRight: HomeHeaderRight }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My profile' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Alerts' }} />
      <Stack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} options={{ title: 'Emergency contacts' }} />
      <Stack.Screen name="EmergencyContactForm" component={EmergencyContactFormScreen} options={{ title: 'Emergency contact' }} />
      <Stack.Screen name="Dependents" component={DependentsScreen} options={{ title: 'Dependents' }} />
      <Stack.Screen name="DependentForm" component={DependentFormScreen} options={{ title: 'Dependent' }} />
    </Stack.Navigator>
  );
}
