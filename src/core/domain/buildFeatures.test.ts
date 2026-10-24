import {
  ALL_BUILD_FEATURES,
  BUILD_FEATURES,
  BUILD_VARIANTS,
  DISABLED_BUILD_FEATURES,
  featuresFor,
} from './buildFeatures';

describe('buildFeatures', () => {
  it('knows exactly two variants, store first', () => {
    expect(BUILD_VARIANTS).toStrictEqual(['store', 'fdroid']);
  });

  it('knows exactly three removable features', () => {
    expect(BUILD_FEATURES).toStrictEqual(['crashReporting', 'otaUpdates', 'speechInput']);
  });

  // The store build is the app as it has always been. A single entry here
  // would silently take a feature away from every Play and App Store user.
  it('leaves nothing out of the store build', () => {
    expect(DISABLED_BUILD_FEATURES.store).toStrictEqual([]);
    expect(featuresFor('store')).toStrictEqual({
      crashReporting: true,
      otaUpdates: true,
      speechInput: true,
    });
    expect(featuresFor('store')).toStrictEqual(ALL_BUILD_FEATURES);
  });

  it('leaves crash reporting and over-the-air updates out of the F-Droid build', () => {
    expect(DISABLED_BUILD_FEATURES.fdroid).toStrictEqual([
      'crashReporting',
      'otaUpdates',
    ]);
    expect(featuresFor('fdroid')).toStrictEqual({
      crashReporting: false,
      otaUpdates: false,
      speechInput: true,
    });
  });

  it('switches off exactly what a table names', () => {
    const table = { store: [], fdroid: ['speechInput'] } as const;
    expect(featuresFor('fdroid', table)).toStrictEqual({
      crashReporting: true,
      otaUpdates: true,
      speechInput: false,
    });
    expect(featuresFor('store', table)).toStrictEqual(ALL_BUILD_FEATURES);
  });

  it('can switch every feature off', () => {
    const table = {
      store: [],
      fdroid: ['crashReporting', 'otaUpdates', 'speechInput'],
    } as const;
    expect(featuresFor('fdroid', table)).toStrictEqual({
      crashReporting: false,
      otaUpdates: false,
      speechInput: false,
    });
  });

  // Frozen, so a screen that mutated what it was handed could not switch a
  // feature back on for everyone else.
  it('hands out frozen answers', () => {
    expect(Object.isFrozen(featuresFor('fdroid'))).toBe(true);
    expect(Object.isFrozen(ALL_BUILD_FEATURES)).toBe(true);
    expect(Object.isFrozen(DISABLED_BUILD_FEATURES)).toBe(true);
    expect(Object.isFrozen(DISABLED_BUILD_FEATURES.fdroid)).toBe(true);
    expect(Object.isFrozen(DISABLED_BUILD_FEATURES.store)).toBe(true);
    expect(Object.isFrozen(BUILD_VARIANTS)).toBe(true);
    expect(Object.isFrozen(BUILD_FEATURES)).toBe(true);
  });
});
