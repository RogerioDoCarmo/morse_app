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

  // ⚠️ UNCONDITIONAL, and it must stay that way — the pods it configures are
  // autolinked from `node_modules`, so they are present whenever the packages
  // are INSTALLED, credential files or not. Gating this on credentials is what
  // broke CI twice. See the plugin for the full reasoning. If Firebase is ever
  // removed from `package.json`, remove this too.
  plugins.push('./plugins/withRNFirebaseDisableSPM.js');

  // The other half of that bargain. Off SPM, Firebase arrives as ordinary pods,
  // and its Swift pods (FirebaseCrashlytics, FirebaseSessions) import
  // GoogleUtilities, GoogleDataTransport and nanopb — none of which define
  // modules, so `pod install` refuses to build them as plain static libraries.
  // Static FRAMEWORKS carry module maps, which satisfies that without moving
  // the app to dynamic linking.
  plugins.push(['expo-build-properties', { ios: { useFrameworks: 'static' } }]);

  // expo-audio is configured HERE rather than in app.json so its microphone
  // string can be read from the one place that owns it.
  //
  // ⚠️ The plugin OVERWRITES ios.infoPlist.NSMicrophoneUsageDescription with a
  // generic default, and `microphonePermission: false` does not opt out — it
  // just looks like no value and the default wins. Passing the real string is
  // the only way to keep it, and sourcing it from infoPlist means the two
  // cannot drift into disagreeing about why this app wants a microphone.
  //
  // Background playback is off deliberately: a Morse message is short and
  // plays in the foreground. Leaving it on adds UIBackgroundModes, a
  // MediaSessionService and two FOREGROUND_SERVICE permissions, all of which
  // would have to be justified at review for a feature the app does not have.
  plugins.push([
    'expo-audio',
    {
      microphonePermission: base.expo.ios.infoPlist.NSMicrophoneUsageDescription,
      // The microphone is for speech input, declared in app.json. Nothing here
      // records anything.
      recordAudioAndroid: false,
      enableBackgroundPlayback: false,
      enableBackgroundRecording: false,
    },
  ]);

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
