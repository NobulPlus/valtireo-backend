import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OrbitMyWorkScreen } from '../screens/OrbitMyWorkScreen';
import { OrbitWorkItemDetailScreen } from '../screens/OrbitWorkItemDetailScreen';
import { OrbitWorkspacesScreen } from '../screens/OrbitWorkspacesScreen';
import { OrbitProjectsScreen } from '../screens/OrbitProjectsScreen';
import { OrbitProjectBoardScreen } from '../screens/OrbitProjectBoardScreen';
import { OrbitNewWorkItemScreen } from '../screens/OrbitNewWorkItemScreen';
import { navigatorScreenOptions, useTheme } from '../theme';

export type OrbitStackParamList = {
  OrbitMyWork: undefined;
  OrbitWorkItemDetail: { itemKey: string };
  OrbitWorkspaces: undefined;
  OrbitProjects: { workspaceId: number; workspaceName: string };
  OrbitProjectBoard: { projectId: number; projectName: string };
  OrbitNewWorkItem: { projectId: number; projectName: string };
};

const Stack = createNativeStackNavigator<OrbitStackParamList>();

function OrbitMyWorkHeaderButtons({ navigation }: { navigation: NativeStackNavigationProp<OrbitStackParamList, 'OrbitMyWork'> }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={() => navigation.navigate('OrbitWorkspaces')} accessibilityLabel="Browse workspaces" style={{ padding: 6 }}>
      <Ionicons name="grid-outline" size={20} color={colors.pine} />
    </Pressable>
  );
}

export function OrbitStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator screenOptions={navigatorScreenOptions(colors)}>
      <Stack.Screen
        name="OrbitMyWork"
        component={OrbitMyWorkScreen}
        options={({ navigation }) => ({ title: 'Orbit', headerRight: () => <OrbitMyWorkHeaderButtons navigation={navigation} /> })}
      />
      <Stack.Screen name="OrbitWorkItemDetail" component={OrbitWorkItemDetailScreen} options={{ title: 'Work item' }} />
      <Stack.Screen name="OrbitWorkspaces" component={OrbitWorkspacesScreen} options={{ title: 'Workspaces' }} />
      <Stack.Screen
        name="OrbitProjects"
        component={OrbitProjectsScreen}
        options={({ route }) => ({ title: route.params.workspaceName })}
      />
      <Stack.Screen
        name="OrbitProjectBoard"
        component={OrbitProjectBoardScreen}
        options={({ route }) => ({ title: route.params.projectName })}
      />
      <Stack.Screen name="OrbitNewWorkItem" component={OrbitNewWorkItemScreen} options={{ title: 'New item' }} />
    </Stack.Navigator>
  );
}
