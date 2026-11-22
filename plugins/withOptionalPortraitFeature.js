const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Declares the portrait screen as an OPTIONAL hardware feature, so Google Play
 * does not filter the app out of devices that cannot guarantee portrait.
 *
 * OmniMorse itself is not locked to portrait (`"orientation": "default"`). The
 * lock arrives with expo-camera: its ML Kit code scanner,
 * `com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity`,
 * is merged into the manifest with `android:screenOrientation="portrait"`, even
 * though this app only uses the camera for the torch and never scans anything.
 * When a manifest requests a fixed orientation and says nothing about the
 * matching feature, Android implies
 * `<uses-feature android:name="android.hardware.screen.portrait" android:required="true"/>`.
 * Play Console reads that as a hard requirement and refuses the release with
 * "required hardware feature declarations are restricting app availability"
 * (it names Phone, Tablet, Desktop and Android XR), which blocked the 0.3.11
 * (19) closed-test release.
 *
 * Declaring the feature explicitly with `android:required="false"` replaces the
 * implied requirement. Nothing else changes: the scanner activity keeps its
 * orientation, and the manifest simply stops promising that every installing
 * device can rotate to portrait.
 *
 * Ported from Miroji (`mirror_app`), which hit the same rejection on its 1.4.0
 * (60) release.
 *
 * The edit is idempotent. It flips an existing entry to optional instead of
 * adding a second one, and leaves every other `uses-feature` entry as it was.
 */
const PORTRAIT_FEATURE = 'android.hardware.screen.portrait';

/**
 * Marks the portrait screen feature as not required in a parsed manifest.
 *
 * @param {{ 'uses-feature'?: Array<{ $: Record<string, string> }> }} manifest The
 *   parsed `<manifest>` element from `@expo/config-plugins`.
 * @returns {object} The same manifest, with the portrait feature set to optional.
 */
function setPortraitFeatureOptional(manifest) {
  const features = manifest['uses-feature'] ?? [];
  const portrait = features.filter(
    (feature) => feature.$['android:name'] === PORTRAIT_FEATURE,
  );

  if (portrait.length === 0) {
    features.push({
      $: { 'android:name': PORTRAIT_FEATURE, 'android:required': 'false' },
    });
  } else {
    portrait.forEach((feature) => {
      feature.$['android:required'] = 'false';
    });
  }

  manifest['uses-feature'] = features;
  return manifest;
}

module.exports = function withOptionalPortraitFeature(config) {
  return withAndroidManifest(config, (cfg) => {
    setPortraitFeatureOptional(cfg.modResults.manifest);
    return cfg;
  });
};

module.exports.setPortraitFeatureOptional = setPortraitFeatureOptional;
