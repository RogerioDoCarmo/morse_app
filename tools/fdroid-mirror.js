#!/usr/bin/env node
/**
 * The steps of the F-Droid build mirror that are worth testing, run by
 * `.github/workflows/android-mirror.yml`. See `notes/FDROID.md`.
 *
 *   node tools/fdroid-mirror.js version <tag>            prints "<versionName> <versionCode>"
 *   node tools/fdroid-mirror.js excluded                 prints the packages to uninstall
 *   node tools/fdroid-mirror.js package <package.json>   marks a package.json as the F-Droid build
 *   node tools/fdroid-mirror.js appjson <app.json>       drops the update and iOS settings from app.json
 *   node tools/fdroid-mirror.js fastlane <out-dir> <versionCode> <versionName>
 *   node tools/fdroid-mirror.js source                   rewrites this repository's fastlane/
 *   node tools/fdroid-mirror.js privacy <out-file>       the F-Droid build's PRIVACY.md
 *
 * The repository root keeps its own copy of the Fastlane tree, for F-Droid's
 * RFP bot and reviewers, who read the SourceCode repository, not the mirror.
 * `fdroid-mirror.test.ts` fails when that copy drifts from the listings.
 *
 * ⚠️ Plain Node, no dependencies: the workflow runs it before anything is
 * installed for the mirror, and F-Droid never runs it at all.
 */
const fs = require('fs');
const path = require('path');
const variants = require('../build-variant');

const ROOT = path.join(__dirname, '..');

/** Packages that arrive only through `@react-native-firebase/*`. */
const FIREBASE_ONLY_BUILT = Object.freeze(['@firebase/util', 'protobufjs']);

/**
 * The version a release tag names, and the versionCode F-Droid will see.
 *
 * Miroji's rule — `major*10000 + minor*100 + patch` — after dropping semver
 * BUILD METADATA, the `+suffix` this repository uses for `v0.3.7+appstore` and
 * `v0.3.7+storybook`, exactly as `release.yml` drops it. A `-suffix` is a
 * PRE-release and is refused: F-Droid would publish it as the real version.
 *
 * ⚠️ minor and patch must stay below 100, or two versions share a code.
 *
 * @param {string} tag
 * @returns {{ versionName: string, versionCode: number }}
 */
function versionFromTag(tag) {
  const stripped = String(tag).replace(/^v/u, '').replace(/\+.*$/u, '');
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(stripped);
  if (match === null) {
    throw new Error(
      `"${tag}" is not a release tag of the form vMAJOR.MINOR.PATCH[+metadata].`,
    );
  }
  const [major, minor, patch] = match.slice(1).map(Number);
  if (minor > 99 || patch > 99) {
    throw new Error(
      `"${tag}": minor and patch must be below 100 for a unique versionCode.`,
    );
  }
  return { versionName: stripped, versionCode: major * 10000 + minor * 100 + patch };
}

/**
 * Turns the mirror's copy of package.json into the F-Droid build's.
 *
 * - names the variant, so `app.config.js` and `metro.config.js` pick it up
 *   when F-Droid's Gradle run evaluates them, with no environment of ours;
 * - forces every Expo module to compile from source rather than use the
 *   prebuilt AARs Expo ships (F-Droid builds everything from source);
 * - drops the `prepare` script, which runs husky — a git-hook installer for
 *   this repository's developers, a dev dependency, and nothing a build needs.
 *
 * ⚠️ Scripts and the `expo`/`omnimorse` fields only. Dependencies are left to
 * `pnpm remove`, so the lockfile and package.json cannot disagree and
 * `pnpm install --frozen-lockfile` still passes on F-Droid's server.
 *
 * @param {Record<string, any>} pkg
 * @returns {Record<string, any>}
 */
function fdroidPackageJson(pkg) {
  const next = JSON.parse(JSON.stringify(pkg));
  next[variants.PACKAGE_FIELD] = {
    ...(next[variants.PACKAGE_FIELD] ?? {}),
    buildVariant: 'fdroid',
  };
  next.expo = next.expo ?? {};
  next.expo.autolinking = next.expo.autolinking ?? {};
  next.expo.autolinking.android = next.expo.autolinking.android ?? {};
  next.expo.autolinking.android.buildFromSource = ['.*'];
  if (next.scripts) delete next.scripts.prepare;
  // Build-script approvals for packages only Firebase brought in. pnpm
  // ignores an entry for a package that is not installed, so these do
  // nothing in the mirror except name Firebase.
  const ignored = next.pnpm?.ignoredBuiltDependencies;
  if (Array.isArray(ignored)) {
    next.pnpm.ignoredBuiltDependencies = ignored.filter(
      (name) => !FIREBASE_ONLY_BUILT.includes(name),
    );
  }
  for (const name of variants.excludedPackages('fdroid')) {
    if (
      next.dependencies?.[name] !== undefined ||
      next.devDependencies?.[name] !== undefined
    ) {
      throw new Error(`${name} is still a dependency. Run pnpm remove before this step.`);
    }
  }
  return next;
}

/**
 * The mirror's copy of app.json, without the over-the-air update settings or
 * the iOS section.
 *
 * `app.config.js` already drops the update settings from the F-Droid config,
 * so the native project is the same either way. This is for the BUNDLE:
 * `src/appVersion.ts` imports app.json whole to read the version, so without
 * this the update server's URL would ride along in the F-Droid JavaScript as
 * dead data.
 *
 * The iOS section is the same kind of dead data, and its permission strings
 * name the platform's vendor, which nothing in the F-Droid tree should.
 *
 * @param {Record<string, any>} appJson
 * @returns {Record<string, any>}
 */
function fdroidAppJson(appJson) {
  const next = JSON.parse(JSON.stringify(appJson));
  delete next.expo.updates;
  delete next.expo.runtimeVersion;
  delete next.expo.ios;
  return next;
}

/** The three listings, and the Fastlane locale directory each becomes. */
const LOCALES = Object.freeze([
  Object.freeze({
    listing: 'en-US',
    fastlane: 'en-US',
    graphic: 'play-feature-graphic.png',
  }),
  Object.freeze({
    listing: 'pt-BR',
    fastlane: 'pt-BR',
    graphic: 'play-feature-graphic.pt-BR.png',
  }),
  // ⚠️ `es`, not `es-419`. The store listing is Latin-American Spanish, but
  // F-Droid's client matches a listing to the phone's locale, and `es` is
  // what a Spanish phone anywhere falls back to.
  Object.freeze({
    listing: 'es-419',
    fastlane: 'es',
    graphic: 'play-feature-graphic.es-419.png',
  }),
]);

/**
 * F-Droid's own limits, from "All About Descriptions, Graphics, and
 * Screenshots" on f-droid.org: title 50, short description 80, full
 * description 4000, each changelog 500.
 */
const LIMITS = Object.freeze({ title: 50, short: 80, full: 4000, changelog: 500 });

/**
 * The store listing's privacy paragraph, and what the F-Droid build says
 * instead.
 *
 * ⚠️ The store paragraph promises crash diagnostics and a switch for them in
 * Settings. The F-Droid build has neither — and no INTERNET permission at
 * all — so the store sentence would be false there. It is replaced whole,
 * and the generator FAILS if the store paragraph has changed, so the two
 * cannot drift apart unnoticed.
 *
 * ⚠️ It also stops saying that nothing you SAY leaves the phone. Speech goes
 * to the device's own recogniser, which on most Android phones is Google's
 * and may send the audio online — F-Droid will ask, and the listing should
 * already answer.
 */
const PRIVACY = Object.freeze({
  'en-US': Object.freeze({
    store:
      'No account. No advertising. No analytics. Nothing you type, say or key ever leaves your phone. The app sends anonymous crash diagnostics so failures can be fixed, and you can switch that off in Settings.',
    fdroid:
      'No account. No advertising. No analytics. No crash reporting. This build has no internet permission at all, so nothing you type or key can leave your phone. Speech input uses your device’s own speech recogniser; depending on which one is installed, it may send your audio to its provider to be transcribed.',
  }),
  'pt-BR': Object.freeze({
    store:
      'Sem conta. Sem anúncios. Sem analytics. Nada do que você digita, fala ou toca sai do seu aparelho. O app envia diagnósticos anônimos de falhas para que os erros possam ser corrigidos, e você pode desligar isso nos Ajustes.',
    fdroid:
      'Sem conta. Sem anúncios. Sem analytics. Sem relatórios de falha. Esta versão não tem permissão de acesso à internet, então nada do que você digita ou toca sai do seu aparelho. A entrada por voz usa o reconhecedor de fala do próprio aparelho; dependendo de qual estiver instalado, ele pode enviar o seu áudio ao fornecedor para ser transcrito.',
  }),
  'es-419': Object.freeze({
    store:
      'Sin cuenta. Sin anuncios. Sin analytics. Nada de lo que escribes, dices o tocas sale de tu teléfono. La app envía diagnósticos anónimos de fallos para poder corregir errores, y puedes desactivarlo en los Ajustes.',
    fdroid:
      'Sin cuenta. Sin anuncios. Sin analytics. Sin informes de fallos. Esta versión no tiene permiso de acceso a internet, así que nada de lo que escribes o tocas sale de tu teléfono. La entrada por voz usa el reconocedor de voz del propio dispositivo; según cuál esté instalado, puede enviar tu audio a su proveedor para transcribirlo.',
  }),
});

/**
 * Screenshots of things the F-Droid build does not have. `f-settings` shows
 * the "Send crash reports" switch.
 */
const SCREENSHOTS_LEFT_OUT = Object.freeze(['f-settings.png']);

/**
 * Other stores' names. An F-Droid listing stands on its own: the reviewer
 * deleted the App Store link from the OmniMorse RFP before closing the first
 * merge request, so no field may name another store or platform.
 */
const OTHER_STORES =
  /\b(?:Apple|App Store|iPhone|iPad|iOS|Google Play|Play Store|Play Console)\b/iu;

/**
 * The build mirror's PRIVACY.md: the F-Droid section of this repository's
 * policy, on its own.
 *
 * ⚠️ The full policy describes crash reports, update checks and iOS speech
 * recognition, none of which the F-Droid build has. Copied as it is, the
 * mirror F-Droid reviews would carry a policy that is wrong for that build.
 * The section between the `fdroid-policy` markers is written to stand alone,
 * and it is one section of one file, so the two cannot drift apart.
 *
 * @param {string} source PRIVACY.md
 * @returns {string}
 */
function fdroidPrivacy(source) {
  const parts = source.split(/^<!-- fdroid-policy:(?:start|end)\b.*-->$/mu);
  if (parts.length !== 3)
    throw new Error('PRIVACY.md needs exactly one fdroid-policy start and end marker.');
  const updated = /^Last updated: (.+)$/mu.exec(source);
  if (updated === null) throw new Error('PRIVACY.md has no "Last updated:" line.');
  const body = parts[1].trim().replace(/^###/gmu, '##');
  const store = OTHER_STORES.exec(body);
  if (store !== null)
    throw new Error(`The F-Droid policy names "${store[0]}"; it names no other store.`);
  return `# Privacy Policy — OmniMorse (F-Droid build)\n\nLast updated: ${updated[1]}\n\n${body}\n`;
}

/**
 * The text of one `## Section` fenced block, the way `store-listing.test.ts`
 * reads it.
 *
 * @param {string} source
 * @param {string} section
 * @returns {string}
 */
function block(source, section) {
  const match = new RegExp(
    `## ${section}\\n\\n(?:[^\`]*\\n\\n)?\`\`\`text\\n([\\s\\S]*?)\`\`\``,
    'u',
  ).exec(source);
  if (match === null) throw new Error(`No "${section}" block in the listing.`);
  return match[1].trimEnd();
}

/**
 * @param {string} text
 * @param {number} limit
 * @param {string} what
 * @returns {string}
 */
function within(text, limit, what) {
  const length = [...text].length;
  if (length > limit)
    throw new Error(`${what} is ${length} characters; F-Droid allows ${limit}.`);
  const store = OTHER_STORES.exec(text);
  if (store !== null)
    throw new Error(
      `${what} names "${store[0]}"; an F-Droid listing names no other store.`,
    );
  return text;
}

/**
 * Everything one locale's Fastlane directory holds as text.
 *
 * @param {string} listingLocale
 * @param {string} source the listing Markdown
 * @returns {{ title: string, short: string, full: string, changelog: string }}
 */
function fastlaneText(listingLocale, source) {
  const privacy = PRIVACY[/** @type {keyof typeof PRIVACY} */ (listingLocale)];
  if (privacy === undefined)
    throw new Error(`No F-Droid privacy text for ${listingLocale}.`);
  const store = block(source, 'Full description');
  const count = store.split(privacy.store).length - 1;
  if (count !== 1) {
    throw new Error(
      `${listingLocale}: the store privacy paragraph has changed (found ${count}). Update PRIVACY in tools/fdroid-mirror.js to match it.`,
    );
  }
  return {
    title: within(block(source, 'App name'), LIMITS.title, `${listingLocale} title`),
    short: within(
      block(source, 'Short description'),
      LIMITS.short,
      `${listingLocale} short description`,
    ),
    full: within(
      store.replace(privacy.store, privacy.fdroid),
      LIMITS.full,
      `${listingLocale} full description`,
    ),
    changelog: within(
      block(source, 'Release notes'),
      LIMITS.changelog,
      `${listingLocale} changelog`,
    ),
  };
}

/**
 * The newest store-assets version folder at or below `versionName`, or null.
 *
 * @param {string} versionName
 * @param {string} [assets]
 * @returns {string | null}
 */
function screenshotVersion(versionName, assets = path.join(ROOT, 'store-assets')) {
  const key = (v) =>
    v
      .split('.')
      .map(Number)
      .reduce((total, part) => total * 1000 + part, 0);
  const candidates = fs
    .readdirSync(assets)
    .filter((name) => /^\d+\.\d+\.\d+$/u.test(name) && key(name) <= key(versionName))
    .sort((a, b) => key(b) - key(a));
  return candidates[0] ?? null;
}

/**
 * Writes `fastlane/metadata/android/<locale>/` for every listing locale.
 *
 * @param {string} outDir the mirror root
 * @param {number} versionCode
 * @param {string} versionName
 * @returns {string[]} the files written, relative to outDir
 */
function writeFastlane(outDir, versionCode, versionName) {
  const written = [];
  const put = (relative, contents) => {
    const target = path.join(outDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof contents === 'string' ? `${contents}\n` : contents);
    written.push(relative.split(path.sep).join('/'));
  };
  const shots = screenshotVersion(versionName);

  for (const locale of LOCALES) {
    const source = fs.readFileSync(
      path.join(ROOT, 'store-assets', 'listing', `${locale.listing}.md`),
      'utf8',
    );
    const text = fastlaneText(locale.listing, source);
    const base = path.join('fastlane', 'metadata', 'android', locale.fastlane);
    put(path.join(base, 'title.txt'), text.title);
    put(path.join(base, 'short_description.txt'), text.short);
    put(path.join(base, 'full_description.txt'), text.full);
    put(path.join(base, 'changelogs', `${versionCode}.txt`), text.changelog);

    const graphics = path.join(ROOT, 'store-assets', 'listing', 'graphics');
    put(
      path.join(base, 'images', 'icon.png'),
      fs.readFileSync(path.join(graphics, 'play-icon-512.png')),
    );
    put(
      path.join(base, 'images', 'featureGraphic.png'),
      fs.readFileSync(path.join(graphics, locale.graphic)),
    );

    if (shots !== null) {
      const dir = path.join(
        ROOT,
        'store-assets',
        shots,
        locale.listing,
        'play-screenshots',
      );
      if (fs.existsSync(dir)) {
        fs.readdirSync(dir)
          .filter((name) => name.endsWith('.png') && !SCREENSHOTS_LEFT_OUT.includes(name))
          .sort()
          .forEach((name, index) => {
            put(
              path.join(base, 'images', 'phoneScreenshots', `${index + 1}.png`),
              fs.readFileSync(path.join(dir, name)),
            );
          });
      }
    }
  }
  return written;
}

/**
 * The version app.json declares, as F-Droid would number it.
 *
 * @returns {{ versionName: string, versionCode: number }}
 */
function currentVersion() {
  const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  return versionFromTag(`v${appJson.expo.version}`);
}

function main(argv) {
  const [command, ...args] = argv;
  switch (command) {
    case 'version': {
      const { versionName, versionCode } = versionFromTag(args[0]);
      process.stdout.write(`${versionName} ${versionCode}\n`);
      return;
    }
    case 'excluded':
      process.stdout.write(`${variants.excludedPackages('fdroid').join(' ')}\n`);
      return;
    case 'package': {
      const file = args[0];
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
      fs.writeFileSync(file, `${JSON.stringify(fdroidPackageJson(pkg), null, 2)}\n`);
      return;
    }
    case 'appjson': {
      const file = args[0];
      const appJson = JSON.parse(fs.readFileSync(file, 'utf8'));
      fs.writeFileSync(file, `${JSON.stringify(fdroidAppJson(appJson), null, 2)}\n`);
      return;
    }
    case 'fastlane': {
      const files = writeFastlane(args[0], Number(args[1]), args[2]);
      process.stdout.write(`${files.join('\n')}\n`);
      return;
    }
    case 'privacy': {
      const source = fs.readFileSync(path.join(ROOT, 'PRIVACY.md'), 'utf8');
      fs.writeFileSync(args[0], fdroidPrivacy(source));
      return;
    }
    case 'source': {
      const { versionName, versionCode } = currentVersion();
      const files = writeFastlane(ROOT, versionCode, versionName);
      process.stdout.write(`${files.join('\n')}\n`);
      return;
    }
    default:
      throw new Error(
        `Unknown command "${command}". See the header of tools/fdroid-mirror.js.`,
      );
  }
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

module.exports = {
  LOCALES,
  LIMITS,
  PRIVACY,
  SCREENSHOTS_LEFT_OUT,
  OTHER_STORES,
  fdroidPrivacy,
  currentVersion,
  versionFromTag,
  fdroidPackageJson,
  fdroidAppJson,
  fastlaneText,
  screenshotVersion,
  writeFastlane,
};
