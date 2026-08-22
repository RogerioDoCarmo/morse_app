const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Strips Android permissions that bundled libraries inject but this app does
 * not use, keeping the RELEASE manifest honest.
 *
 * Removals go into a release-only source set
 * (`android/app/src/release/AndroidManifest.xml`), so they apply ONLY to
 * production builds. Debug builds are untouched, which keeps dev tooling
 * working — notably SYSTEM_ALERT_WINDOW for the RN dev menu and LogBox, and
 * INTERNET for the Metro bundler.
 *
 * ⚠️ This list is deliberately NOT a copy of Miroji's. `RECORD_AUDIO` is
 * genuinely needed here for speech input, whereas Miroji strips it. Audit any
 * new dependency against this list rather than assuming it still holds.
 *
 * What this app keeps in release:
 *   - CAMERA        → the torch. There is no separate torch permission on
 *                     either platform.
 *   - RECORD_AUDIO  → speech input. Genuinely used.
 *
 * ⚠️ DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION will still show up in a built
 * artifact. That is androidx declaring a signature-level permission for its own
 * broadcast receivers. It is not user-facing, not grantable to other apps, and
 * must NOT be stripped — removing it weakens security.
 */
const PERMISSIONS_TO_REMOVE = [
  // React Native core, for the Metro dev server and the debugger. This app is
  // offline-only: no fetch, no analytics, no crash reporting, no OTA check, and
  // a release build loads its bundle from the APK's own assets.
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  // Expo prebuild's default set, inherited from Expo Go. No haptics dependency
  // here and the Vibration API is never called.
  'android.permission.VIBRATE',
  // React Native dev tooling only.
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.DUMP',
  // Legacy storage, injected by file-system modules. Nothing is written to
  // shared storage.
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];

function buildReleaseManifest() {
  const removals = PERMISSIONS_TO_REMOVE.map(
    (name) => `    <uses-permission android:name="${name}" tools:node="remove" />`,
  ).join('\n');

  return (
    '<manifest xmlns:android="http://schemas.android.com/apk/res/android"\n' +
    '    xmlns:tools="http://schemas.android.com/tools">\n' +
    `${removals}\n` +
    '</manifest>\n'
  );
}

module.exports = function withCleanAndroidPermissions(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const releaseDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'release',
      );
      fs.mkdirSync(releaseDir, { recursive: true });
      fs.writeFileSync(
        path.join(releaseDir, 'AndroidManifest.xml'),
        buildReleaseManifest(),
      );
      return cfg;
    },
  ]);
};

module.exports.PERMISSIONS_TO_REMOVE = PERMISSIONS_TO_REMOVE;
