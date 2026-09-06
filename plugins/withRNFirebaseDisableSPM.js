const { withPodfile } = require('expo/config-plugins');

/**
 * Makes react-native-firebase resolve the Firebase Apple SDK through CocoaPods
 * instead of Swift Package Manager.
 *
 * ⚠️ This must be applied UNCONDITIONALLY, for the same reason the iOS build
 * settings are: the `@react-native-firebase/*` pods are autolinked from
 * `node_modules`, so they are in the Podfile whenever the packages are
 * INSTALLED — whether or not the credential files exist and the Firebase config
 * plugins run. Anything that configures those pods has to be keyed off the same
 * fact, or local and CI diverge.
 *
 * Why not SPM: firebase-ios-sdk's Swift Package products are automatic
 * libraries, so EVERY react-native-firebase pod that resolves Firebase through
 * SPM statically embeds its own copy. With two of them installed (app and
 * crashlytics) the app then fails to link with ~460 duplicate symbols in
 * FirebaseCore, FirebaseCoreInternal and FirebaseInstallations.
 *
 * react-native-firebase suggests `use_frameworks! :linkage => :dynamic` as the
 * alternative. It is NOT equivalent: it satisfies the check `pod install`
 * performs, but the pods still built as static archives and the duplicate
 * symbols came back at link time. It also switches every pod in the project to
 * dynamic frameworks, which is a large blast radius for a two-pod problem.
 *
 * `@react-native-firebase/app`'s own config plugin exposes this as
 * `ios.disableSPM`, but that plugin also requires `googleServicesFile`, so it
 * cannot run on a checkout without credentials. Same flag, applied where it can
 * always run.
 */
const FLAG = '$RNFirebaseDisableSPM = true';

// firebase_spm.rb reads the flag as the pods are declared, so it has to be set
// before any target block.
const ANCHOR = 'prepare_react_native_project!';

function setDisableSPM(contents) {
  if (contents.includes(FLAG)) return contents;

  if (!contents.includes(ANCHOR)) {
    // Silently doing nothing here would resurrect the duplicate-symbol link
    // failure with no clue as to why, so fail the prebuild instead.
    throw new Error(
      `withRNFirebaseDisableSPM: could not find "${ANCHOR}" in the Podfile. ` +
        'Expo changed the template — re-anchor this plugin before any target block.',
    );
  }

  return contents.replace(
    ANCHOR,
    `${ANCHOR}\n\n# Firebase via CocoaPods, not SPM. See plugins/withRNFirebaseDisableSPM.js\n${FLAG}`,
  );
}

module.exports = function withRNFirebaseDisableSPM(config) {
  return withPodfile(config, (cfg) => {
    cfg.modResults.contents = setDisableSPM(cfg.modResults.contents);
    return cfg;
  });
};

module.exports.setDisableSPM = setDisableSPM;
module.exports.FLAG = FLAG;
module.exports.ANCHOR = ANCHOR;
