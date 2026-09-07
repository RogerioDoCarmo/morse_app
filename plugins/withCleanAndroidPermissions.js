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
 * working — notably SYSTEM_ALERT_WINDOW for the RN dev menu and LogBox. That
 * is also why every bug this file has caused showed up only in release.
 *
 * ⚠️ This list is deliberately NOT a copy of Miroji's. `RECORD_AUDIO` is
 * genuinely needed here for speech input, whereas Miroji strips it. Audit any
 * new dependency against this list rather than assuming it still holds.
 *
 * ⚠️ What the app KEEPS is not written here. It is `android.permissions` in
 * `app.json`, and `withCleanAndroidPermissions.test.ts` fails if the two lists
 * ever name the same permission. That is deliberate: two prose lists in one
 * comment is how VIBRATE came to sit on both sides at once, and a comment
 * cannot fail a build. Anything the release build needs — including the ones
 * a library injects and nobody would think to declare, like INTERNET and
 * ACCESS_NETWORK_STATE for Crashlytics — goes in `app.json` so the test can
 * see it.
 *
 * ⚠️ DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION will still show up in a built
 * artifact. That is androidx declaring a signature-level permission for its own
 * broadcast receivers. It is not user-facing, not grantable to other apps, and
 * must NOT be stripped — removing it weakens security.
 */
const PERMISSIONS_TO_REMOVE = [
  // ⚠️ Three permissions came OFF this list, all for the same reason, and all
  // three removals are deliberate reversals rather than oversights. The first
  // Android E2E run to reach the flows found the last two of them in one
  // logcat:
  //
  //   INTERNET — Crashlytics uploads crash reports, so the app stopped being
  //   offline-only. Stripping it does not make it safer; it makes crash
  //   reporting fail SILENTLY.
  //
  //   ACCESS_NETWORK_STATE — this comment used to claim Crashlytics does not
  //   require it. It does. Its transport stamps the network type on every
  //   event, and without the permission the emulator logged
  //   "Crashlytics report could not be enqueued to DataTransport" with a
  //   SecurityException from ConnectivityManager.getActiveNetworkInfo. Caught,
  //   so nothing crashed — Android release builds simply never sent a report.
  //
  //   VIBRATE — the Vibrate output channel calls it. `Vibration.cancel()` runs
  //   whenever playback is put back to rest, including the cleanup that fires
  //   every time the message changes, so it did not wait for anyone to switch
  //   Vibrate on. Android throws SecurityException from native code, which in
  //   bridgeless mode lands on the ReactHost handler rather than the adapter's
  //   try/catch: expo-updates' error recovery gives up and the process dies.
  //
  // Debug builds keep all three, which is why none of them ever showed up
  // outside a release build. If a feature is dropped, put its permission back
  // here AND take it out of app.json — the test checks both.
  //
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
module.exports.buildReleaseManifest = buildReleaseManifest;
