jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

function preloadReactNativeComponents(...names) {
  const reactNative = require('react-native');
  names.forEach((name) => reactNative[name]);
}

preloadReactNativeComponents('ScrollView', 'Text', 'Image', 'Pressable', 'Animated');
