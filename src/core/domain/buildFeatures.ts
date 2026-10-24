/**
 * Features a build variant can leave out, and which ones each variant does.
 *
 * ⚠️ NOT THE SAME THING AS `featureFlags.ts`. Those are kill switches for a
 * defect found on a tester's phone, meant to be flipped back within a release.
 * These are permanent and per build: the store build has everything, and the
 * F-Droid build — which F-Droid compiles from source and may not contain
 * proprietary code or phone home — leaves some of it out for good.
 *
 * ⚠️ A switch here REMOVES a feature; it does not hide it. The same table lives
 * in `build-variant.js` at the repository root, where `app.config.js`,
 * `metro.config.js` and the F-Droid mirror workflow read it to keep the
 * feature's native module, config plugin, permissions and JavaScript out of
 * the build entirely. `build-variant.test.ts` fails if the two disagree. What
 * this file decides is everything the user would otherwise SEE of the
 * feature: its tab, its Settings rows, its buttons.
 */

/** Every variant this app is built as. */
export const BUILD_VARIANTS = Object.freeze(['store', 'fdroid'] as const);

/** One of the two builds: the store one, or the one F-Droid compiles. */
export type BuildVariant = (typeof BUILD_VARIANTS)[number];

/** Every feature a variant can leave out. */
export const BUILD_FEATURES = Object.freeze([
  'crashReporting',
  'otaUpdates',
  'speechInput',
] as const);

/** One feature a variant can leave out. */
export type BuildFeature = (typeof BUILD_FEATURES)[number];

/** Which features one build contains. */
export type BuildFeatures = Readonly<Record<BuildFeature, boolean>>;

/**
 * What each variant leaves OUT. The store entry is empty, and must stay so:
 * the store build is the app as it has always been.
 *
 * `speechInput` is deliberately NOT in the F-Droid list. The recogniser is
 * the platform's own SpeechRecognizer, which F-Droid treats as a platform
 * API; see `notes/FDROID.md` for why, and for what would change the answer.
 */
export const DISABLED_BUILD_FEATURES: Readonly<
  Record<BuildVariant, readonly BuildFeature[]>
> = Object.freeze({
  store: Object.freeze([]),
  fdroid: Object.freeze(['crashReporting', 'otaUpdates'] as const),
});

/**
 * The features one variant contains.
 *
 * ⚠️ Takes the withheld table as an optional parameter for the tests, the
 * same way `featureFlags.ts` does — nothing in the app passes it.
 */
export function featuresFor(
  variant: BuildVariant,
  disabled: Readonly<
    Record<BuildVariant, readonly BuildFeature[]>
  > = DISABLED_BUILD_FEATURES,
): BuildFeatures {
  const off = disabled[variant];
  return Object.freeze(
    Object.fromEntries(
      BUILD_FEATURES.map((feature) => [feature, !off.includes(feature)]),
    ) as Record<BuildFeature, boolean>,
  );
}

/**
 * Every feature on, written out rather than derived, so a test can hold the
 * store variant to it.
 */
export const ALL_BUILD_FEATURES: BuildFeatures = Object.freeze({
  crashReporting: true,
  otaUpdates: true,
  speechInput: true,
});
