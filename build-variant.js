const fs = require('fs');
const path = require('path');

/**
 * Which build this is, and what that build is allowed to contain.
 *
 * Two variants exist. `store` is what goes to Google Play and the App Store,
 * and it is everything the app does today — the default, and the answer
 * whenever nothing says otherwise. `fdroid` is the build F-Droid compiles from
 * source, which may not contain proprietary code, may not update itself, and
 * may not phone home. See `notes/FDROID.md` for the reasoning behind each
 * entry below.
 *
 * ⚠️ ONE TABLE, THREE READERS. `app.config.js` drops the config plugins and
 * permissions of a disabled feature, `metro.config.js` keeps its JavaScript
 * out of the bundle, and the mirror workflow removes its packages before
 * prebuild so autolinking never sees them. The app's own screens read the
 * same switches from `src/core/domain/buildFeatures.ts`, and
 * `build-variant.test.ts` fails if the two tables disagree.
 *
 * ⚠️ A disabled feature is REMOVED, not hidden. F-Droid's scanner and its
 * reviewers look at what is compiled into the APK, not at what is on screen,
 * so a switch that only greyed out a button would be a switch that did
 * nothing they could see.
 */

/** Set this to build a variant other than the store one. */
const VARIABLE = 'OMNIMORSE_BUILD_VARIANT';

/**
 * The same choice, written into `package.json` as `omnimorse.buildVariant`.
 *
 * ⚠️ F-Droid's build server runs Gradle without any environment of ours, and
 * Gradle's bundling step evaluates `app.config.js` and `metro.config.js` again.
 * An environment variable set while the mirror was generated would be gone by
 * then, so the mirror carries the choice in a file that travels with it.
 */
const PACKAGE_FIELD = 'omnimorse';

const VARIANTS = Object.freeze(['store', 'fdroid']);

/** Features that a build variant can leave out entirely. */
const FEATURES = Object.freeze(['crashReporting', 'otaUpdates', 'speechInput']);

/**
 * What each variant leaves OUT. The healthy store entry is empty.
 *
 * - `crashReporting`: Firebase Crashlytics is proprietary, and F-Droid's
 *   inclusion policy names it outright.
 * - `otaUpdates`: expo-updates checks a server on launch and can replace the
 *   JavaScript the user installed. F-Droid forbids an app downloading code
 *   outside its own review, and counts an update check as Tracking.
 *
 * `speechInput` stays ON in the F-Droid build: the recogniser is the
 * platform's `android.speech.SpeechRecognizer`, which F-Droid accepts as a
 * platform API. Turning it off is a one-word edit here, and everything that
 * reads this table follows.
 */
const DISABLED_FEATURES = Object.freeze({
  store: Object.freeze([]),
  fdroid: Object.freeze(['crashReporting', 'otaUpdates']),
});

/** The npm packages, and so the native modules and config plugins, each feature brings. */
const NATIVE_PACKAGES = Object.freeze({
  crashReporting: Object.freeze([
    '@react-native-firebase/app',
    '@react-native-firebase/crashlytics',
  ]),
  otaUpdates: Object.freeze(['expo-updates']),
  speechInput: Object.freeze(['expo-speech-recognition']),
});

/**
 * Android permissions that exist only for a feature.
 *
 * A permission is dropped when EVERY feature listing it is off. INTERNET is
 * listed twice for that reason: either of the two network features keeps it.
 * Permissions listed under no feature are always kept.
 */
const PERMISSIONS = Object.freeze({
  crashReporting: Object.freeze([
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
  ]),
  otaUpdates: Object.freeze([
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
  ]),
  speechInput: Object.freeze(['android.permission.RECORD_AUDIO']),
});

/**
 * Reads the variant named in a parsed `package.json`, or null when it names none.
 *
 * @param {Record<string, unknown> | null | undefined} packageJson
 * @returns {string | null}
 */
function fromPackageJson(packageJson) {
  const field = packageJson?.[PACKAGE_FIELD];
  if (field === null || typeof field !== 'object') return null;
  const value = /** @type {Record<string, unknown>} */ (field).buildVariant;
  return typeof value === 'string' ? value : null;
}

/** @returns {Record<string, unknown>} */
function readPackageJson() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
}

/**
 * The variant to build.
 *
 * ⚠️ An unknown name THROWS rather than falling back to `store`. A typo in the
 * F-Droid mirror would otherwise build the store app — Firebase and all — and
 * the first sign would be F-Droid's scanner rejecting it.
 *
 * ⚠️ So does a disagreement between the environment and `package.json`. Either
 * one alone is a clear instruction; both saying different things is a build
 * that has been configured twice and cannot be trusted to mean either.
 *
 * @param {{ env?: Record<string, string | undefined>, packageJson?: Record<string, unknown> }} [sources]
 * @returns {'store' | 'fdroid'}
 */
function resolveBuildVariant(sources = {}) {
  const env = sources.env ?? process.env;
  const packageJson = sources.packageJson ?? readPackageJson();

  const raw = env[VARIABLE];
  const fromEnv = typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;
  const fromFile = fromPackageJson(packageJson);

  if (fromEnv !== null && fromFile !== null && fromEnv !== fromFile) {
    throw new Error(
      `${VARIABLE}=${fromEnv} disagrees with package.json ${PACKAGE_FIELD}.buildVariant=${fromFile}.`,
    );
  }
  const chosen = fromEnv ?? fromFile ?? 'store';
  if (!VARIANTS.includes(chosen)) {
    throw new Error(
      `Unknown build variant "${chosen}". Expected one of: ${VARIANTS.join(', ')}.`,
    );
  }
  return /** @type {'store' | 'fdroid'} */ (chosen);
}

/**
 * @param {string} variant
 * @returns {readonly string[]}
 */
function disabledFeatures(variant) {
  const disabled = DISABLED_FEATURES[/** @type {'store' | 'fdroid'} */ (variant)];
  if (disabled === undefined) throw new Error(`Unknown build variant "${variant}".`);
  return disabled;
}

/**
 * Whether a feature is part of this variant.
 *
 * @param {string} variant
 * @param {string} feature
 * @returns {boolean}
 */
function hasFeature(variant, feature) {
  if (!FEATURES.includes(feature)) throw new Error(`Unknown build feature "${feature}".`);
  return !disabledFeatures(variant).includes(feature);
}

/**
 * Every package the variant must not contain, in table order.
 *
 * @param {string} variant
 * @returns {string[]}
 */
function excludedPackages(variant) {
  return disabledFeatures(variant).flatMap(
    (feature) => NATIVE_PACKAGES[/** @type {keyof typeof NATIVE_PACKAGES} */ (feature)],
  );
}

/**
 * Permissions the variant must not request, in table order without repeats.
 *
 * @param {string} variant
 * @returns {string[]}
 */
function droppedPermissions(variant) {
  const off = disabledFeatures(variant);
  const owned = FEATURES.flatMap(
    (feature) => PERMISSIONS[/** @type {keyof typeof PERMISSIONS} */ (feature)],
  );
  return [...new Set(owned)].filter((permission) =>
    FEATURES.filter((feature) =>
      PERMISSIONS[/** @type {keyof typeof PERMISSIONS} */ (feature)].includes(permission),
    ).every((feature) => off.includes(feature)),
  );
}

/**
 * Whether a module request names one of the excluded packages or a file inside it.
 *
 * @param {string} moduleName
 * @param {readonly string[]} packages
 * @returns {boolean}
 */
function isExcludedModule(moduleName, packages) {
  return packages.some(
    (name) => moduleName === name || moduleName.startsWith(`${name}/`),
  );
}

/**
 * Metro's half: a disabled feature's packages resolve to an empty module, and
 * `*.fdroid.ts` files win over their store twins.
 *
 * The store variant gets the config it was handed, untouched — the same object,
 * so the store bundle cannot differ from the one built before this existed.
 *
 * ⚠️ EMPTY, NOT MISSING. The packages are uninstalled in the mirror, so an
 * import that reached the resolver would fail the bundle. The adapters that
 * import them are never constructed when their feature is off — the
 * composition root checks the switch first — so the empty module is never
 * read, only resolved.
 *
 * @template {{ resolver?: Record<string, any> }} T
 * @param {T} config
 * @param {string} [variant]
 * @returns {T}
 */
function withBuildVariant(config, variant = resolveBuildVariant()) {
  if (variant === 'store') return config;

  const packages = excludedPackages(variant);
  const resolver = config.resolver ?? {};
  const upstream = resolver.resolveRequest;
  const sourceExts = resolver.sourceExts ?? ['ts', 'tsx', 'js', 'jsx', 'json'];

  return {
    ...config,
    resolver: {
      ...resolver,
      sourceExts: [
        ...['ts', 'tsx', 'js'].map((ext) => `${variant}.${ext}`),
        ...sourceExts,
      ],
      /**
       * @param {{ resolveRequest: Function }} context
       * @param {string} moduleName
       * @param {string | null} platform
       */
      resolveRequest(context, moduleName, platform) {
        if (isExcludedModule(moduleName, packages)) return { type: 'empty' };
        return typeof upstream === 'function'
          ? upstream(context, moduleName, platform)
          : context.resolveRequest(context, moduleName, platform);
      },
    },
  };
}

module.exports = {
  VARIABLE,
  PACKAGE_FIELD,
  VARIANTS,
  FEATURES,
  DISABLED_FEATURES,
  NATIVE_PACKAGES,
  PERMISSIONS,
  resolveBuildVariant,
  disabledFeatures,
  hasFeature,
  excludedPackages,
  droppedPermissions,
  isExcludedModule,
  withBuildVariant,
};
