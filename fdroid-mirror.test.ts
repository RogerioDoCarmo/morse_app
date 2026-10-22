import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mirror = require('./tools/fdroid-mirror.js') as {
  LOCALES: readonly { listing: string; fastlane: string; graphic: string }[];
  LIMITS: Record<string, number>;
  PRIVACY: Record<string, { store: string; fdroid: string }>;
  SCREENSHOTS_LEFT_OUT: readonly string[];
  versionFromTag: (tag: string) => { versionName: string; versionCode: number };
  fdroidPackageJson: (pkg: Record<string, unknown>) => {
    omnimorse?: unknown;
    scripts: Record<string, string | undefined>;
    dependencies: Record<string, string | undefined>;
  };
  fastlaneText: (
    locale: string,
    source: string,
  ) => { title: string; short: string; full: string; changelog: string };
  screenshotVersion: (versionName: string, assets?: string) => string | null;
  writeFastlane: (outDir: string, versionCode: number, versionName: string) => string[];
};

const listing = (locale: string): string =>
  fs.readFileSync(
    path.join(__dirname, 'store-assets', 'listing', `${locale}.md`),
    'utf8',
  );

describe('the versionCode a release tag becomes', () => {
  it.each([
    ['v0.3.7', '0.3.7', 307],
    ['v0.3.7+appstore', '0.3.7', 307],
    ['v0.3.7+storybook', '0.3.7', 307],
    ['0.4.0', '0.4.0', 400],
    ['v1.3.1', '1.3.1', 10301],
    ['v2.0.12', '2.0.12', 20012],
  ])('%s is %s, code %i', (tag, name, code) => {
    expect(mirror.versionFromTag(tag)).toStrictEqual({
      versionName: name,
      versionCode: code,
    });
  });

  // A pre-release sorts BEFORE its version; F-Droid would ship it as the
  // real one, so it is refused, like release.yml refuses it.
  it.each([['v0.3.7-rc1'], ['v0.3'], ['latest'], ['v0.3.7.1']])('refuses %s', (tag) => {
    expect(() => mirror.versionFromTag(tag)).toThrow('is not a release tag');
  });

  it('refuses a minor or patch that would collide with the next digit', () => {
    expect(() => mirror.versionFromTag('v0.100.0')).toThrow('must be below 100');
    expect(() => mirror.versionFromTag('v0.1.100')).toThrow('must be below 100');
  });
});

describe('the mirror’s package.json', () => {
  const pruned = {
    name: 'morse-app',
    scripts: { prepare: 'husky', test: 'jest' },
    dependencies: { expo: '~57.0.15' },
    expo: { other: true },
  };

  it('names the variant, builds every module from source and drops husky', () => {
    expect(mirror.fdroidPackageJson(pruned)).toStrictEqual({
      name: 'morse-app',
      scripts: { test: 'jest' },
      dependencies: { expo: '~57.0.15' },
      expo: { other: true, autolinking: { android: { buildFromSource: ['.*'] } } },
      omnimorse: { buildVariant: 'fdroid' },
    });
  });

  it('does not change what it was given', () => {
    const copy = JSON.parse(JSON.stringify(pruned)) as typeof pruned;
    mirror.fdroidPackageJson(pruned);
    expect(pruned).toStrictEqual(copy);
  });

  // Uninstalling is pnpm's job, so lockfile and manifest agree. This step
  // only refuses to carry on if it was skipped.
  it.each([
    ['@react-native-firebase/app'],
    ['@react-native-firebase/crashlytics'],
    ['expo-updates'],
  ])('refuses a package.json that still depends on %s', (name) => {
    expect(() => mirror.fdroidPackageJson({ dependencies: { [name]: '1.0.0' } })).toThrow(
      `${name} is still a dependency`,
    );
  });

  it('accepts this repository’s package.json once the packages are removed', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'),
    ) as {
      dependencies: Record<string, string>;
    };
    for (const name of [
      '@react-native-firebase/app',
      '@react-native-firebase/crashlytics',
      'expo-updates',
    ]) {
      delete pkg.dependencies[name];
    }
    const out = mirror.fdroidPackageJson(pkg);
    expect(out.omnimorse).toStrictEqual({ buildVariant: 'fdroid' });
    expect(out.scripts.prepare).toBeUndefined();
    expect(out.dependencies['expo-speech-recognition']).toBeDefined();
  });
});

describe('the F-Droid listing', () => {
  it('writes three locales, Spanish as plain es', () => {
    expect(mirror.LOCALES.map((locale) => locale.fastlane)).toStrictEqual([
      'en-US',
      'pt-BR',
      'es',
    ]);
  });

  it('holds F-Droid’s published limits', () => {
    expect(mirror.LIMITS).toStrictEqual({
      title: 50,
      short: 80,
      full: 4000,
      changelog: 500,
    });
  });

  it.each(['en-US', 'pt-BR', 'es-419'])('fits every %s field inside them', (locale) => {
    const text = mirror.fastlaneText(locale, listing(locale));
    expect(text.title).toBe('OmniMorse');
    expect([...text.short].length).toBeLessThanOrEqual(80);
    expect([...text.full].length).toBeLessThanOrEqual(4000);
    expect([...text.changelog].length).toBeLessThanOrEqual(500);
  });

  /**
   * ⚠️ The store copy promises crash diagnostics and a Settings switch for
   * them. The F-Droid build has neither, so the claim must not survive into
   * its listing, in any language.
   */
  it.each([
    ['en-US', /crash diagnostics|switch that off in Settings/u, 'No crash reporting.'],
    [
      'pt-BR',
      /diagnósticos anônimos|desligar isso nos Ajustes/u,
      'Sem relatórios de falha.',
    ],
    [
      'es-419',
      /diagnósticos anónimos|desactivarlo en los Ajustes/u,
      'Sin informes de fallos.',
    ],
  ])('replaces the %s crash-report promise', (locale, promise, replacement) => {
    const { full } = mirror.fastlaneText(locale, listing(locale));
    expect(full).not.toMatch(promise);
    expect(full).toContain(replacement);
    expect(listing(locale)).toMatch(promise);
  });

  it('fails loudly when the store paragraph has drifted', () => {
    const drifted = listing('en-US').replace(
      'anonymous crash diagnostics',
      'crash reports',
    );
    expect(() => mirror.fastlaneText('en-US', drifted)).toThrow(
      'en-US: the store privacy paragraph has changed (found 0).',
    );
  });

  it('fails when a field outgrows F-Droid’s limit', () => {
    const long = listing('en-US').replace(
      /## Short description\n\n```text\n[^`]*```/u,
      `## Short description\n\n\`\`\`text\n${'x'.repeat(81)}\n\`\`\``,
    );
    expect(() => mirror.fastlaneText('en-US', long)).toThrow(
      'en-US short description is 81 characters; F-Droid allows 80.',
    );
  });

  it('uses the newest screenshot set at or below the version', () => {
    expect(mirror.screenshotVersion('0.3.7')).toBe('0.3.7');
    expect(mirror.screenshotVersion('0.3.9')).toBe('0.3.7');
    expect(mirror.screenshotVersion('0.3.5')).toBe('0.3.5');
    expect(mirror.screenshotVersion('0.1.0')).toBeNull();
  });

  // The Settings screenshot shows the crash-report switch.
  it('leaves out the screenshot of what the build does not have', () => {
    expect(mirror.SCREENSHOTS_LEFT_OUT).toStrictEqual(['f-settings.png']);
  });

  describe('written to disk', () => {
    let out: string;
    let files: string[];

    beforeAll(() => {
      out = fs.mkdtempSync(path.join(os.tmpdir(), 'fastlane-'));
      files = mirror.writeFastlane(out, 307, '0.3.7');
    });

    afterAll(() => {
      fs.rmSync(out, { recursive: true, force: true });
    });

    it.each(['en-US', 'pt-BR', 'es'])(
      'lays out %s the way F-Droid reads it',
      (locale) => {
        const base = `fastlane/metadata/android/${locale}`;
        expect(files).toEqual(
          expect.arrayContaining([
            `${base}/title.txt`,
            `${base}/short_description.txt`,
            `${base}/full_description.txt`,
            `${base}/changelogs/307.txt`,
            `${base}/images/icon.png`,
            `${base}/images/featureGraphic.png`,
            `${base}/images/phoneScreenshots/1.png`,
            `${base}/images/phoneScreenshots/5.png`,
          ]),
        );
        expect(files).not.toContain(`${base}/images/phoneScreenshots/6.png`);
      },
    );

    it('writes the title with one trailing newline', () => {
      expect(
        fs.readFileSync(
          path.join(out, 'fastlane/metadata/android/en-US/title.txt'),
          'utf8',
        ),
      ).toBe('OmniMorse\n');
    });

    it('copies the icon byte for byte', () => {
      expect(
        fs
          .readFileSync(path.join(out, 'fastlane/metadata/android/es/images/icon.png'))
          .equals(
            fs.readFileSync(
              path.join(__dirname, 'store-assets/listing/graphics/play-icon-512.png'),
            ),
          ),
      ).toBe(true);
    });
  });
});
