import * as fs from 'fs';
import * as path from 'path';
import { DISABLED_BUILD_FEATURES, BUILD_FEATURES } from '@/core/domain/buildFeatures';

// CommonJS, loaded by app.config.js and metro.config.js the same way.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const variant = require('./build-variant.js') as {
  VARIABLE: string;
  PACKAGE_FIELD: string;
  VARIANTS: readonly string[];
  FEATURES: readonly string[];
  DISABLED_FEATURES: Record<string, readonly string[]>;
  NATIVE_PACKAGES: Record<string, readonly string[]>;
  resolveBuildVariant: (sources?: {
    env?: Record<string, string | undefined>;
    packageJson?: Record<string, unknown>;
  }) => string;
  hasFeature: (variant: string, feature: string) => boolean;
  excludedPackages: (variant: string) => string[];
  droppedPermissions: (variant: string) => string[];
  isExcludedModule: (moduleName: string, packages: readonly string[]) => boolean;
  withBuildVariant: <T extends { resolver?: Record<string, unknown> }>(
    config: T,
    variant?: string,
  ) => T;
};

describe('build-variant.js', () => {
  /**
   * ⚠️ TWO TABLES THAT MUST BE ONE. This file is read by Node at prebuild and
   * bundle time; `buildFeatures.ts` by the app. If they disagreed, the build
   * would strip a native module while the UI still offered the feature, or
   * keep one the UI had hidden.
   */
  it('agrees with the app’s own table', () => {
    expect(variant.FEATURES).toStrictEqual([...BUILD_FEATURES]);
    expect(variant.DISABLED_FEATURES).toStrictEqual({
      store: [...DISABLED_BUILD_FEATURES.store],
      fdroid: [...DISABLED_BUILD_FEATURES.fdroid],
    });
  });

  describe('choosing the variant', () => {
    it('is the store build when nothing names one', () => {
      expect(variant.resolveBuildVariant({ env: {}, packageJson: {} })).toBe('store');
    });

    it('reads the environment variable', () => {
      expect(variant.VARIABLE).toBe('OMNIMORSE_BUILD_VARIANT');
      expect(
        variant.resolveBuildVariant({
          env: { OMNIMORSE_BUILD_VARIANT: 'fdroid' },
          packageJson: {},
        }),
      ).toBe('fdroid');
    });

    it('reads package.json, which is what the F-Droid mirror carries', () => {
      expect(variant.PACKAGE_FIELD).toBe('omnimorse');
      expect(
        variant.resolveBuildVariant({
          env: {},
          packageJson: { omnimorse: { buildVariant: 'fdroid' } },
        }),
      ).toBe('fdroid');
    });

    it('accepts both when they agree', () => {
      expect(
        variant.resolveBuildVariant({
          env: { OMNIMORSE_BUILD_VARIANT: ' fdroid ' },
          packageJson: { omnimorse: { buildVariant: 'fdroid' } },
        }),
      ).toBe('fdroid');
    });

    it('treats a blank variable as unset', () => {
      expect(
        variant.resolveBuildVariant({
          env: { OMNIMORSE_BUILD_VARIANT: '  ' },
          packageJson: {},
        }),
      ).toBe('store');
    });

    it('ignores a package.json field that is not an object or names nothing', () => {
      expect(
        variant.resolveBuildVariant({ env: {}, packageJson: { omnimorse: 'fdroid' } }),
      ).toBe('store');
      expect(
        variant.resolveBuildVariant({
          env: {},
          packageJson: { omnimorse: { buildVariant: 3 } },
        }),
      ).toBe('store');
    });

    // A typo must not quietly build the store app, Firebase and all.
    it('refuses an unknown name', () => {
      expect(() =>
        variant.resolveBuildVariant({
          env: { OMNIMORSE_BUILD_VARIANT: 'froid' },
          packageJson: {},
        }),
      ).toThrow('Unknown build variant "froid". Expected one of: store, fdroid.');
    });

    it('refuses a build configured two different ways', () => {
      expect(() =>
        variant.resolveBuildVariant({
          env: { OMNIMORSE_BUILD_VARIANT: 'store' },
          packageJson: { omnimorse: { buildVariant: 'fdroid' } },
        }),
      ).toThrow(
        'OMNIMORSE_BUILD_VARIANT=store disagrees with package.json omnimorse.buildVariant=fdroid.',
      );
    });

    // The repository's own package.json must never name a variant: that is
    // the mirror's job, and a committed one would turn every store build
    // into an F-Droid one.
    it('finds no variant in this repository’s package.json', () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'),
      ) as Record<string, unknown>;
      expect(packageJson.omnimorse).toBeUndefined();
      expect(variant.resolveBuildVariant({ env: {} })).toBe('store');
    });
  });

  describe('what each variant contains', () => {
    it('gives the store build every feature', () => {
      for (const feature of variant.FEATURES) {
        expect(variant.hasFeature('store', feature)).toBe(true);
      }
      expect(variant.excludedPackages('store')).toStrictEqual([]);
      expect(variant.droppedPermissions('store')).toStrictEqual([]);
    });

    it('leaves Firebase and expo-updates out of the F-Droid build', () => {
      expect(variant.hasFeature('fdroid', 'crashReporting')).toBe(false);
      expect(variant.hasFeature('fdroid', 'otaUpdates')).toBe(false);
      expect(variant.hasFeature('fdroid', 'speechInput')).toBe(true);
      expect(variant.excludedPackages('fdroid')).toStrictEqual([
        '@react-native-firebase/app',
        '@react-native-firebase/crashlytics',
        'expo-updates',
      ]);
    });

    // With both network features gone the app has nothing to send, so it
    // should not be able to.
    it('drops INTERNET and ACCESS_NETWORK_STATE from the F-Droid build, keeps RECORD_AUDIO', () => {
      expect(variant.droppedPermissions('fdroid')).toStrictEqual([
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE',
      ]);
    });

    it('refuses an unknown variant or feature rather than guessing', () => {
      expect(() => variant.excludedPackages('play')).toThrow(
        'Unknown build variant "play".',
      );
      expect(() => variant.hasFeature('fdroid', 'ads')).toThrow(
        'Unknown build feature "ads".',
      );
    });
  });

  describe('the Metro half', () => {
    const packages = ['@react-native-firebase/app', 'expo-updates'];

    it.each([
      ['@react-native-firebase/app', true],
      ['@react-native-firebase/app/lib/common', true],
      ['expo-updates', true],
      ['expo-updates-interface', false],
      ['@react-native-firebase/crashlytics', false],
      ['expo-audio', false],
    ])('treats %s as excluded: %p', (name, expected) => {
      expect(variant.isExcludedModule(name, packages)).toBe(expected);
    });

    // Not a copy: the very object, so the store bundle cannot have changed.
    it('hands the store build its config back untouched', () => {
      const config = { resolver: { sourceExts: ['ts'] } };
      expect(variant.withBuildVariant(config, 'store')).toBe(config);
    });

    it('puts the F-Droid twins first and empties the excluded packages', () => {
      const upstream = jest.fn(() => ({ type: 'sourceFile', filePath: '/x.js' }));
      const config = variant.withBuildVariant(
        { resolver: { sourceExts: ['ts', 'tsx', 'js'], resolveRequest: upstream } },
        'fdroid',
      ) as unknown as {
        resolver: {
          sourceExts: string[];
          resolveRequest: (c: unknown, m: string, p: string | null) => unknown;
        };
      };

      expect(config.resolver.sourceExts).toStrictEqual([
        'fdroid.ts',
        'fdroid.tsx',
        'fdroid.js',
        'ts',
        'tsx',
        'js',
      ]);
      expect(
        config.resolver.resolveRequest(
          {},
          '@react-native-firebase/crashlytics',
          'android',
        ),
      ).toStrictEqual({
        type: 'empty',
      });
      expect(config.resolver.resolveRequest({}, 'expo-updates', 'android')).toStrictEqual(
        {
          type: 'empty',
        },
      );
      expect(upstream).not.toHaveBeenCalled();
      expect(config.resolver.resolveRequest({}, 'expo-audio', 'android')).toStrictEqual({
        type: 'sourceFile',
        filePath: '/x.js',
      });
      expect(upstream).toHaveBeenCalledWith({}, 'expo-audio', 'android');
    });

    it('falls back to Metro’s own resolver when nothing was chained', () => {
      const resolveRequest = jest.fn(() => ({ type: 'sourceFile', filePath: '/y.js' }));
      const config = variant.withBuildVariant({}, 'fdroid') as unknown as {
        resolver: {
          resolveRequest: (c: unknown, m: string, p: string | null) => unknown;
        };
      };
      const context = { resolveRequest };

      expect(config.resolver.resolveRequest(context, 'react', 'android')).toStrictEqual({
        type: 'sourceFile',
        filePath: '/y.js',
      });
      expect(resolveRequest).toHaveBeenCalledWith(context, 'react', 'android');
    });
  });
});
