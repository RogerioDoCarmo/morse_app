import * as fs from 'fs';

// A `jest.spyOn` here would not reach it: Babel's CJS interop hands this test a
// COPY of the fs namespace, so the spy lands on the copy while `app.config.js`
// keeps calling the original. Replacing the module in the registry is what the
// config actually requires.
jest.mock('fs', () => {
  const actual = jest.requireActual<typeof fs>('fs');
  return { ...actual, existsSync: jest.fn(actual.existsSync) };
});

const mockedExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

type Plugin = string | [string, Record<string, unknown>?];

const ANDROID = 'google-services.json';
const IOS = 'GoogleService-Info.plist';

const CLEANER = './plugins/withCleanAndroidPermissions.js';

/** Loads the real config with only the named credential files "on disk". */
function loadConfig(present: readonly string[]): {
  expo: {
    plugins: Plugin[];
    owner?: string;
    slug?: string;
    extra?: { eas?: { projectId?: string } };
    android?: { googleServicesFile?: string };
    ios?: {
      googleServicesFile?: string;
      infoPlist?: Record<string, unknown>;
      privacyManifests?: {
        NSPrivacyAccessedAPITypes?: {
          NSPrivacyAccessedAPIType: string;
          NSPrivacyAccessedAPITypeReasons: string[];
        }[];
        NSPrivacyTracking?: boolean;
        NSPrivacyTrackingDomains?: string[];
        NSPrivacyCollectedDataTypes?: unknown[];
      };
    };
  };
} {
  mockedExistsSync.mockImplementation((file) =>
    present.some((name) => String(file).endsWith(name)),
  );
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('./app.config.js') as () => never)();
}

const nameOf = (plugin: Plugin): string => (Array.isArray(plugin) ? plugin[0] : plugin);

const DISABLE_SPM = './plugins/withRNFirebaseDisableSPM.js';

describe('app.config', () => {
  // The regression this exists for: the pods come from package.json and are
  // autolinked unconditionally, so whatever configures them has to be
  // unconditional too. Gating it on credentials passed locally and broke CI.
  it.each([
    ['no credentials', []],
    ['android only', [ANDROID]],
    ['ios only', [IOS]],
    ['both', [ANDROID, IOS]],
  ])('takes Firebase off SPM and onto static frameworks with %s', (_label, present) => {
    const plugins = loadConfig(present).expo.plugins;

    expect(plugins.map(nameOf).filter((name) => name === DISABLE_SPM)).toHaveLength(1);

    const buildProperties = plugins.filter(
      (plugin): plugin is [string, Record<string, unknown>?] =>
        Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
    );
    expect(buildProperties).toHaveLength(1);
    expect(buildProperties[0]?.[1]).toEqual({ ios: { useFrameworks: 'static' } });
  });

  // EAS resolves the project from owner + slug + projectId, and cannot write
  // any of them itself here: `eas init` refuses to touch a dynamic config and
  // exits telling you to add `owner` by hand. Losing one of these does not
  // fail a build — it fails the LINK, with a message about the config file
  // rather than about the field that went missing.
  //
  // Checked through the resolved config rather than app.json, since that is
  // what EAS actually reads, and app.config.js rebuilds the object.
  it.each([
    ['no credentials', []],
    ['both', [ANDROID, IOS]],
  ])('keeps the identity EAS resolves the project by, with %s', (_label, present) => {
    const { expo } = loadConfig(present);

    expect(expo.owner).toBe('rogeriodocarmo');
    expect(expo.slug).toBe('morse-app');
    expect(expo.extra?.eas?.projectId).toBe('2868776d-8058-43b4-928b-44b5fa312998');
  });

  // Apple rejected build 2 with ITMS-90683 for want of this one. expo-camera
  // is linked for the torch, and its photo-capture APIs reference the library
  // whether or not this app ever calls them — "your app might not use these
  // APIs, a purpose string is still required".
  //
  // A missing purpose string does not fail a build. It fails the upload, after
  // Apple has finished processing it, by email.
  it('carries a purpose string for every protected API its dependencies link', () => {
    const { expo } = loadConfig([ANDROID, IOS]);
    const plist = expo.ios?.infoPlist ?? {};

    expect(
      Object.keys(plist)
        .filter((key) => key.startsWith('NS'))
        .sort(),
    ).toStrictEqual([
      'NSCameraUsageDescription',
      'NSMicrophoneUsageDescription',
      'NSPhotoLibraryUsageDescription',
      'NSSpeechRecognitionUsageDescription',
    ]);
    for (const key of Object.keys(plist).filter((name) => name.startsWith('NS'))) {
      expect(String(plist[key]).length).toBeGreaterThan(20);
    }
  });

  // Without this key App Store Connect halts EVERY build on the export
  // compliance question and waits for a human. The app ships no cryptography
  // of its own — the only thing that leaves the device is a Crashlytics
  // report over HTTPS, which is exempt.
  it('declares the app exempt from export compliance', () => {
    const { expo } = loadConfig([ANDROID, IOS]);
    expect(expo.ios?.infoPlist?.ITSAppUsesNonExemptEncryption).toBe(false);
  });

  // Apple rejects an upload that touches a required-reason API without saying
  // why, and the reason codes are theirs — an invented one fails validation
  // rather than being ignored.
  it('gives a reason for every restricted API it touches', () => {
    const { expo } = loadConfig([ANDROID, IOS]);
    const declared = expo.ios?.privacyManifests?.NSPrivacyAccessedAPITypes ?? [];

    expect(declared.map((entry) => entry.NSPrivacyAccessedAPIType)).toStrictEqual([
      'NSPrivacyAccessedAPICategoryUserDefaults',
      'NSPrivacyAccessedAPICategoryFileTimestamp',
      'NSPrivacyAccessedAPICategoryDiskSpace',
      'NSPrivacyAccessedAPICategorySystemBootTime',
    ]);
    for (const entry of declared) {
      expect(entry.NSPrivacyAccessedAPITypeReasons.length).toBeGreaterThan(0);
    }
  });

  // The privacy label has to match what the app does. It collects crash
  // diagnostics and nothing else, it does not link them to anyone, and there
  // is no advertising identifier anywhere in the app to track with.
  it('claims crash data only, unlinked and untracked', () => {
    const { expo } = loadConfig([ANDROID, IOS]);
    const manifests = expo.ios?.privacyManifests;

    expect(manifests?.NSPrivacyTracking).toBe(false);
    expect(manifests?.NSPrivacyTrackingDomains).toStrictEqual([]);
    expect(manifests?.NSPrivacyCollectedDataTypes).toStrictEqual([
      {
        NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCrashData',
        NSPrivacyCollectedDataTypeLinked: false,
        NSPrivacyCollectedDataTypeTracking: false,
        NSPrivacyCollectedDataTypePurposes: [
          'NSPrivacyCollectedDataTypePurposeAppFunctionality',
        ],
      },
    ]);
  });

  // The expo-audio plugin overwrites NSMicrophoneUsageDescription with a
  // generic default unless it is handed the real string, and `false` does not
  // opt out. If these two ever disagree, the App Store review text silently
  // becomes "Allow $(PRODUCT_NAME) to access your microphone".
  it('gives expo-audio the same microphone reason app.json declares', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const appJson = require('./app.json') as {
      expo: { ios: { infoPlist: { NSMicrophoneUsageDescription: string } } };
    };
    const audio = loadConfig([]).expo.plugins.find(
      (plugin): plugin is [string, Record<string, unknown>] =>
        Array.isArray(plugin) && plugin[0] === 'expo-audio',
    );

    expect(audio?.[1]?.microphonePermission).toBe(
      appJson.expo.ios.infoPlist.NSMicrophoneUsageDescription,
    );
    expect(audio?.[1]?.microphonePermission).not.toBe(false);
  });

  // This plugin keeps an infoPlist string that is already there rather than
  // overwriting it, unlike expo-audio. Passing ours anyway means the review
  // text does not depend on someone else's `||` chain staying that way.
  it('gives expo-speech-recognition the reasons app.json declares', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const appJson = require('./app.json') as {
      expo: {
        ios: {
          infoPlist: {
            NSMicrophoneUsageDescription: string;
            NSSpeechRecognitionUsageDescription: string;
          };
        };
      };
    };
    const speech = loadConfig([]).expo.plugins.find(
      (plugin): plugin is [string, Record<string, unknown>] =>
        Array.isArray(plugin) && plugin[0] === 'expo-speech-recognition',
    );

    expect(speech?.[1]?.microphonePermission).toBe(
      appJson.expo.ios.infoPlist.NSMicrophoneUsageDescription,
    );
    expect(speech?.[1]?.speechRecognitionPermission).toBe(
      appJson.expo.ios.infoPlist.NSSpeechRecognitionUsageDescription,
    );
  });

  // Background playback would add UIBackgroundModes, a MediaSessionService and
  // two FOREGROUND_SERVICE permissions for a feature the app does not have.
  it('keeps expo-audio in the foreground and out of the microphone', () => {
    const audio = loadConfig([]).expo.plugins.find(
      (plugin): plugin is [string, Record<string, unknown>] =>
        Array.isArray(plugin) && plugin[0] === 'expo-audio',
    );

    expect(audio?.[1]).toEqual(
      expect.objectContaining({
        recordAudioAndroid: false,
        enableBackgroundPlayback: false,
        enableBackgroundRecording: false,
      }),
    );
  });

  it('adds the Firebase plugins only once credentials exist', () => {
    expect(loadConfig([]).expo.plugins.map(nameOf)).not.toContain(
      '@react-native-firebase/app',
    );
    expect(loadConfig([ANDROID]).expo.plugins.map(nameOf)).toEqual(
      expect.arrayContaining([
        '@react-native-firebase/app',
        '@react-native-firebase/crashlytics',
      ]),
    );
  });

  // It strips what earlier plugins injected, so anything appended after it
  // would silently survive into the release manifest.
  it.each([
    ['no credentials', []],
    ['both credentials', [ANDROID, IOS]],
  ])('keeps the permission cleaner last with %s', (_label, present) => {
    const plugins = loadConfig(present).expo.plugins;

    expect(plugins.filter((plugin) => nameOf(plugin) === CLEANER)).toHaveLength(1);
    expect(nameOf(plugins[plugins.length - 1] as Plugin)).toBe(CLEANER);
  });

  // An EAS builder never sees the working tree's untracked files, so a build
  // there gets its copy from a file environment variable holding a path. Both
  // Firebase packages are dependencies, so their pods autolink whatever the
  // plugins do — and the Crashlytics build phase reads GOOGLE_APP_ID straight
  // out of the plist. Without this the config would say "no Firebase" while
  // the native build still demanded the file.
  describe('credentials handed over by an EAS file variable', () => {
    const VARIABLES = ['GOOGLE_SERVICES_JSON_PATH', 'GOOGLE_SERVICE_INFO_PLIST_PATH'];

    afterEach(() => {
      for (const variable of VARIABLES) delete process.env[variable];
    });

    it('uses the path it is given when no file is on disk', () => {
      process.env.GOOGLE_SERVICE_INFO_PLIST_PATH = '/builder/secrets/ios.plist';
      const { expo } = loadConfig([]);

      expect(expo.ios?.googleServicesFile).toBe('/builder/secrets/ios.plist');
      expect(expo.plugins.map(nameOf)).toContain('@react-native-firebase/app');
    });

    it('takes the variable over a file of the same name on disk', () => {
      process.env.GOOGLE_SERVICES_JSON_PATH = '/builder/secrets/android.json';
      const { expo } = loadConfig([ANDROID]);

      expect(expo.android?.googleServicesFile).toBe('/builder/secrets/android.json');
    });

    // Each platform answers for itself: a build handed only the iOS plist must
    // not claim Android is instrumented.
    it('leaves the other platform alone', () => {
      process.env.GOOGLE_SERVICE_INFO_PLIST_PATH = '/builder/secrets/ios.plist';
      const { expo } = loadConfig([]);

      expect(expo.android?.googleServicesFile).toBeUndefined();
    });
  });

  /**
   * The microphone copy said "Audio is not stored and never leaves your
   * device" — in the iOS permission dialog itself, which is the one place a
   * user has no reason to doubt. It was not true: the adapter never sets
   * `requiresOnDeviceRecognition`, so iOS is free to send the audio to Apple,
   * and the app's own privacy policy said so.
   *
   * Forcing on-device recognition would make the sentence true and cost
   * users the feature — it is unavailable on plenty of devices and locales —
   * so the copy was corrected instead. This is a biconditional on purpose: it
   * fails if the old promise comes back, AND it fails if someone starts
   * forcing on-device recognition without strengthening the copy that could
   * then honestly be strengthened.
   */
  describe('the microphone copy and what the recogniser actually does', () => {
    const realFs = jest.requireActual<typeof fs>('fs');
    const read = (relative: string): string =>
      realFs.readFileSync(`${__dirname}/${relative}`, 'utf8');

    const forcesOnDevice = /requiresOnDeviceRecognition:\s*true/.test(
      read('src/adapters/speech/expoSpeechRecognitionAdapter.ts'),
    );

    const plist = loadConfig([ANDROID, IOS]).expo.ios?.infoPlist ?? {};

    /** The claim, in each language it is made in. */
    const KEEPS_IT_HERE =
      /never leaves your device|is ever uploaded|nenhum áudio é enviado|no se sube ning/i;

    it.each([
      ['the microphone prompt', String(plist.NSMicrophoneUsageDescription)],
      [
        'the speech-recognition prompt',
        String(plist.NSSpeechRecognitionUsageDescription),
      ],
      ['the English assurance', read('src/i18n/translations/en.ts')],
      ['the Portuguese assurance', read('src/i18n/translations/pt.ts')],
      ['the Spanish assurance', read('src/i18n/translations/es.ts')],
    ])(
      '%s promises the audio stays here only if the app makes it stay',
      (_label, text) => {
        expect(KEEPS_IT_HERE.test(text)).toBe(forcesOnDevice);
      },
    );

    // The prompts have to say what does happen, not merely stop saying what
    // does not. A reviewer reads these too.
    it('says who may receive the audio instead', () => {
      expect(String(plist.NSMicrophoneUsageDescription)).toMatch(/Apple/);
      expect(String(plist.NSSpeechRecognitionUsageDescription)).toMatch(/Apple/);
    });
  });

  it('points each platform at its own credential file', () => {
    const androidOnly = loadConfig([ANDROID]).expo;
    expect(androidOnly.android?.googleServicesFile).toBe('./google-services.json');
    expect(androidOnly.ios?.googleServicesFile).toBeUndefined();

    const iosOnly = loadConfig([IOS]).expo;
    expect(iosOnly.ios?.googleServicesFile).toBe('./GoogleService-Info.plist');
    expect(iosOnly.android?.googleServicesFile).toBeUndefined();
  });
});
