const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Declares the hardware this app can live without as OPTIONAL, so Google Play
 * does not filter the app out of devices that lack it.
 *
 * Android IMPLIES a required `<uses-feature>` for things the manifest never
 * mentions. `aapt2 dump badging` on the 0.3.11 APK listed three:
 *
 * - `android.hardware.screen.portrait` — "one or more activities have specified
 *   a portrait orientation". Not ours: OmniMorse is `"orientation": "default"`.
 *   The lock comes from expo-camera's ML Kit code scanner,
 *   `com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity`,
 *   merged in with `android:screenOrientation="portrait"` although this app
 *   never scans anything. Play Console refused the 0.3.11 (19) closed-test
 *   release over it: "required hardware feature declarations are restricting
 *   app availability" (Phone, Tablet, Desktop, Android XR).
 * - `android.hardware.camera` — "requested android.permission.CAMERA". The
 *   camera is only the torch, one of four outputs; sound, screen and vibration
 *   work without it.
 * - `android.hardware.microphone` — "requested android.permission.RECORD_AUDIO".
 *   Only speech input needs it, and that screen already reports speech as
 *   unavailable when there is no recogniser to use.
 *
 * Declaring each explicitly with `android:required="false"` replaces the
 * implied requirement. Nothing else changes: the permissions stay, and the
 * scanner activity keeps its orientation.
 *
 * Ported from Miroji's `withOptionalPortraitFeature` (`mirror_app`), which hit
 * the same rejection on its 1.4.0 (60) release, and widened to the list above.
 *
 * The edit is idempotent. It flips an existing entry to optional instead of
 * adding a second one, and leaves every other `uses-feature` entry as it was.
 */
const OPTIONAL_FEATURES = Object.freeze([
  'android.hardware.screen.portrait',
  'android.hardware.camera',
  'android.hardware.microphone',
]);

/**
 * Marks every feature in OPTIONAL_FEATURES as not required in a parsed manifest.
 *
 * @param {{ 'uses-feature'?: Array<{ $: Record<string, string> }> }} manifest The
 *   parsed `<manifest>` element from `@expo/config-plugins`.
 * @returns {object} The same manifest, with those features set to optional.
 */
function setFeaturesOptional(manifest) {
  const features = manifest['uses-feature'] ?? [];

  for (const name of OPTIONAL_FEATURES) {
    const declared = features.filter((feature) => feature.$['android:name'] === name);

    if (declared.length === 0) {
      features.push({ $: { 'android:name': name, 'android:required': 'false' } });
    } else {
      declared.forEach((feature) => {
        feature.$['android:required'] = 'false';
      });
    }
  }

  manifest['uses-feature'] = features;
  return manifest;
}

module.exports = function withOptionalHardwareFeatures(config) {
  return withAndroidManifest(config, (cfg) => {
    setFeaturesOptional(cfg.modResults.manifest);
    return cfg;
  });
};

module.exports.OPTIONAL_FEATURES = OPTIONAL_FEATURES;
module.exports.setFeaturesOptional = setFeaturesOptional;
