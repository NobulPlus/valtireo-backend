module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Must stay last — react-native-reanimated's plugin rewrites worklets, so any
    // plugin ordered after it would see already-transformed code.
    plugins: ['react-native-worklets/plugin'],
  };
};
