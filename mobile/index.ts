// Must be the very first import — react-native-gesture-handler (a peer dependency
// of the Quick Access drag-to-reorder list) sets up its native event handling at
// module-load time, before anything else touches the UI thread.
import 'react-native-gesture-handler';

import { LogBox } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';

// react-native-draggable-flatlist (Quick Access's drag-to-reorder list) calls the
// now-deprecated InteractionManager internally on every reorder — harmless, and
// nothing we can fix from app code, so it's silenced rather than left as noise.
LogBox.ignoreLogs(['InteractionManager has been deprecated']);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
