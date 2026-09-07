// The plugin is CommonJS, loaded by Expo the same way.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('./withCleanAndroidPermissions.js') as {
  PERMISSIONS_TO_REMOVE: string[];
  buildReleaseManifest: () => string;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const appJson = require('../app.json') as {
  expo: { android: { permissions: string[] } };
};

const { PERMISSIONS_TO_REMOVE, buildReleaseManifest } = plugin;
const declared = appJson.expo.android.permissions;

describe('withCleanAndroidPermissions', () => {
  // The two sides are written in different files and nothing but this connects
  // them. When they disagreed, `Vibration.cancel()` threw SecurityException in
  // release only — bridgeless React hands a native throw to the host handler
  // rather than to the adapter's try/catch, expo-updates' error recovery gives
  // up, and the process dies. Nine Maestro flows found it; no unit test could,
  // because the manifest is the only place the contradiction exists.
  it('never strips a permission app.json declares', () => {
    expect(PERMISSIONS_TO_REMOVE.filter((name) => declared.includes(name))).toStrictEqual(
      [],
    );
  });

  // Named one by one rather than left to the rule above, which an empty
  // app.json would satisfy vacuously. Each of these three was stripped from a
  // release build at some point while the code that needs it was already
  // shipping.
  it.each([
    ['VIBRATE, which the Vibrate output channel calls', 'android.permission.VIBRATE'],
    ['INTERNET, which Crashlytics uploads over', 'android.permission.INTERNET'],
    [
      'ACCESS_NETWORK_STATE, which Crashlytics reads before every upload',
      'android.permission.ACCESS_NETWORK_STATE',
    ],
  ])('keeps %s', (_label, permission) => {
    expect(declared).toContain(permission);
  });

  // The two prompted permissions first, then the three a library injects and
  // the app would never ask for. They are all here because this list, not the
  // plugin's comment, is what the rule above reads.
  it('declares exactly what the release build needs', () => {
    expect(declared).toStrictEqual([
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.VIBRATE',
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.MODIFY_AUDIO_SETTINGS',
    ]);
  });

  describe('the release manifest', () => {
    // A removal without the tools namespace is not a removal — the merger
    // fails the build on the unbound prefix, or worse, an editor "fixes" it by
    // dropping the attribute and every removal silently becomes a no-op.
    it('binds the tools namespace it uses', () => {
      expect(buildReleaseManifest()).toContain(
        'xmlns:tools="http://schemas.android.com/tools"',
      );
    });

    it('asks the merger to remove each listed permission', () => {
      const manifest = buildReleaseManifest();

      for (const name of PERMISSIONS_TO_REMOVE) {
        expect(manifest).toContain(
          `<uses-permission android:name="${name}" tools:node="remove" />`,
        );
      }
    });

    it('removes nothing else', () => {
      const names = [...buildReleaseManifest().matchAll(/android:name="([^"]+)"/g)].map(
        (match) => match[1],
      );

      expect(names).toStrictEqual(PERMISSIONS_TO_REMOVE);
    });
  });
});
