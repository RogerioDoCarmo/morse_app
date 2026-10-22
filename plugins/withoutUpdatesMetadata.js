const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Removes the `expo.modules.updates.*` meta-data from the Android manifest.
 *
 * Used only by a build that leaves over-the-air updates out (the F-Droid
 * variant; see `build-variant.js`). That build has `expo-updates`
 * UNINSTALLED, yet Expo's prebuild still writes four meta-data entries for it
 * from its built-in config — `ENABLED=false`, the check-on-launch policy and
 * the rest. Nothing in the APK reads them without the module, so they do
 * nothing; but they say "this app updates itself" to anyone reading the
 * manifest, and F-Droid's reviewers read the manifest.
 */
const PREFIX = 'expo.modules.updates.';

/**
 * @param {{ application?: { 'meta-data'?: { $: Record<string, string> }[] }[] }} manifest
 * @returns {typeof manifest}
 */
function stripUpdatesMetadata(manifest) {
  for (const application of manifest.application ?? []) {
    if (Array.isArray(application['meta-data'])) {
      application['meta-data'] = application['meta-data'].filter(
        (entry) => !String(entry.$?.['android:name'] ?? '').startsWith(PREFIX),
      );
    }
  }
  return manifest;
}

module.exports = function withoutUpdatesMetadata(config) {
  return withAndroidManifest(config, (cfg) => {
    stripUpdatesMetadata(cfg.modResults.manifest);
    return cfg;
  });
};

module.exports.PREFIX = PREFIX;
module.exports.stripUpdatesMetadata = stripUpdatesMetadata;
