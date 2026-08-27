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
    android?: { googleServicesFile?: string };
    ios?: { googleServicesFile?: string };
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

  it('points each platform at its own credential file', () => {
    const androidOnly = loadConfig([ANDROID]).expo;
    expect(androidOnly.android?.googleServicesFile).toBe('./google-services.json');
    expect(androidOnly.ios?.googleServicesFile).toBeUndefined();

    const iosOnly = loadConfig([IOS]).expo;
    expect(iosOnly.ios?.googleServicesFile).toBe('./GoogleService-Info.plist');
    expect(iosOnly.android?.googleServicesFile).toBeUndefined();
  });
});
