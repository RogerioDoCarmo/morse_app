const fs = require('fs');
const path = require('path');

const base = require('./app.json');

/**
 * Layers Firebase on top of `app.json` — but only the parts that are actually
 * optional.
 *
 * `@react-native-firebase/app` makes `googleServicesFile` mandatory: with the
 * plugin listed and the file absent, `expo prebuild` fails outright. That would
 * break a fresh checkout, CI (the E2E workflow prebuilds), and any build that
 * must ship without a proprietary dependency.
 *
 * So the presence of the credential files decides whether the app is
 * instrumented. Drop them in and crashes are reported; leave them out and the
 * app builds and runs exactly as before, with `createPorts` selecting the no-op
 * crash reporter to match. The two layers — native config here, adapter
 * selection there — have to agree, and both key off the same fact.
 *
 * ⚠️ The iOS framework linkage is NOT part of that bargain. See below.
 */
const ANDROID_CREDENTIALS = 'google-services.json';
const IOS_CREDENTIALS = 'GoogleService-Info.plist';

const exists = (file) => fs.existsSync(path.join(__dirname, file));

module.exports = () => {
  const expo = { ...base.expo };
  const hasAndroid = exists(ANDROID_CREDENTIALS);
  const hasIos = exists(IOS_CREDENTIALS);

  // The permission cleaner writes the release manifest by stripping what earlier
  // plugins injected, so it has to stay last however this list is assembled.
  const cleaner = './plugins/withCleanAndroidPermissions.js';
  const plugins = expo.plugins.filter((entry) => entry !== cleaner);

  // ⚠️ UNCONDITIONAL, and it must stay that way. react-native-firebase resolves
  // the Firebase Apple SDK through Swift Package Manager on RN 0.75+, and its
  // SPM products are automatic libraries — under the default static linkage
  // every pod embeds its own copy and they collide as duplicate symbols. Pods
  // are autolinked from `node_modules`, so they are in the Podfile whenever the
  // packages are INSTALLED; the credential files have nothing to do with it.
  //
  // Gating this on credentials is what broke CI: it prebuilt without them, got
  // the pods without the linkage, and `pod install` died with "SPM + static
  // linkage is not supported". If Firebase is ever removed from
  // `package.json`, remove this too.
  plugins.push(['expo-build-properties', { ios: { useFrameworks: 'dynamic' } }]);

  if (hasAndroid || hasIos) {
    plugins.push('@react-native-firebase/app', '@react-native-firebase/crashlytics');
  }

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
