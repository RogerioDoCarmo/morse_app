const fs = require('fs');
const path = require('path');

const base = require('./app.json');

/**
 * Layers Firebase on top of `app.json` — but only when it is actually
 * configured.
 *
 * `@react-native-firebase/app` makes `googleServicesFile` mandatory: with the
 * plugin listed and the file absent, `expo prebuild` fails outright. That would
 * break a fresh checkout, CI (the E2E workflow prebuilds), and any build that
 * must ship without a proprietary dependency.
 *
 * So the presence of the credential files decides. Drop them in and the app is
 * instrumented; leave them out and it builds and runs exactly as before, with
 * `createPorts` selecting the no-op crash reporter to match. The two layers —
 * native config here, adapter selection there — have to agree, and both key off
 * the same fact.
 */
const ANDROID_CREDENTIALS = 'google-services.json';
const IOS_CREDENTIALS = 'GoogleService-Info.plist';

const exists = (file) => fs.existsSync(path.join(__dirname, file));

module.exports = () => {
  const expo = { ...base.expo };
  const hasAndroid = exists(ANDROID_CREDENTIALS);
  const hasIos = exists(IOS_CREDENTIALS);

  if (!hasAndroid && !hasIos) return { ...base, expo };

  // The permission cleaner writes the release manifest by stripping what earlier
  // plugins injected, so it has to stay last however this list is assembled.
  const cleaner = './plugins/withCleanAndroidPermissions.js';
  const plugins = expo.plugins.filter((entry) => entry !== cleaner);

  plugins.push('@react-native-firebase/app', '@react-native-firebase/crashlytics', [
    'expo-build-properties',
    // React Native Firebase resolves the Firebase Apple SDK through Swift
    // Package Manager on RN 0.75+, and SPM requires dynamic frameworks.
    { ios: { useFrameworks: 'dynamic' } },
  ]);
  plugins.push(cleaner);

  return {
    ...base,
    expo: {
      ...expo,
      plugins,
      android: hasAndroid
        ? { ...expo.android, googleServicesFile: `./${ANDROID_CREDENTIALS}` }
        : expo.android,
      ios: hasIos
        ? { ...expo.ios, googleServicesFile: `./${IOS_CREDENTIALS}` }
        : expo.ios,
    },
  };
};
