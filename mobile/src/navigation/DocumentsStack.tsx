import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DocumentsListScreen } from '../screens/DocumentsListScreen';
import { UploadDocumentScreen } from '../screens/UploadDocumentScreen';
import { navigatorScreenOptions, useTheme } from '../theme';

export type DocumentsStackParamList = {
  DocumentsList: undefined;
  UploadDocument: undefined;
};

const Stack = createNativeStackNavigator<DocumentsStackParamList>();

export function DocumentsStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator screenOptions={navigatorScreenOptions(colors)}>
      <Stack.Screen name="DocumentsList" component={DocumentsListScreen} options={{ title: 'Documents' }} />
      <Stack.Screen name="UploadDocument" component={UploadDocumentScreen} options={{ title: 'Upload document' }} />
    </Stack.Navigator>
  );
}
