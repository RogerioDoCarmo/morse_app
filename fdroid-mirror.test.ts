import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mirror = require('./tools/fdroid-mirror.js') as {
  LOCALES: readonly { listing: string; fastlane: string; graphic: string }[];
  LIMITS: Record<string, number>;
  PRIVACY: Record<string, { store: string; fdroid: string }>;
  SCREENSHOTS_LEFT_OUT: readonly string[];
  OTHER_STORES: RegExp;
  fdroidPrivacy: (source: string) => string;
  currentVersion: () => { versionName: string; versionCode: number };
  versionFromTag: (tag: string) => { versionName: string; versionCode: number };
  fdroidPackageJson: (pkg: Record<string, unknown>) => {
    omnimorse?: unknown;
    scripts: Record<string, string | undefined>;
    dependencies: Record<string, string | undefined>;
  };
  fdroidAppJson: (appJson: { expo: Record<string, unknown> }) => {
    expo: Record<string, unknown>;
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

  it('drops build approvals for packages only Firebase brought, and keeps the rest', () => {
    const out = mirror.fdroidPackageJson({
      pnpm: { ignoredBuiltDependencies: ['@firebase/util', 'esbuild', 'protobufjs'] },
    }) as unknown as { pnpm: { ignoredBuiltDependencies: string[] } };
    expect(out.pnpm.ignoredBuiltDependencies).toStrictEqual(['esbuild']);
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

describe('the mirror’s app.json', () => {
  const appJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'),
  ) as {
    expo: Record<string, unknown>;
  };

  // src/appVersion.ts bundles app.json whole, so the update URL would
  // otherwise ship in the F-Droid JavaScript as dead data.
  it('drops the update server and the runtime version', () => {
    const out = mirror.fdroidAppJson(appJson);
    expect(out.expo.updates).toBeUndefined();
    expect(out.expo.runtimeVersion).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('u.expo.dev');
  });

  it('keeps everything else, the version and identity first of all', () => {
    const out = mirror.fdroidAppJson(appJson);
    const rest = { ...appJson.expo };
    delete rest.updates;
    delete rest.runtimeVersion;
    expect(out.expo).toStrictEqual(rest);
    expect(out.expo.version).toBe(appJson.expo.version);
    expect(appJson.expo.updates).toBeDefined();
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

  // An F-Droid listing stands on its own: the reviewer deleted the App Store
  // link from the first RFP.
  it.each([
    'Apple',
    'App Store',
    'iPhone',
    'iPad',
    'iOS',
    'Google Play',
    'Play Store',
    'Play Console',
  ])('refuses a field that names %s', (store) => {
    const named = listing('en-US').replace(
      /## Short description\n\n```text\n[^`]*```/u,
      `## Short description\n\n\`\`\`text\nAlso on ${store.toLowerCase()}.\n\`\`\``,
    );
    expect(() => mirror.fastlaneText('en-US', named)).toThrow(
      `en-US short description names "${store.toLowerCase()}"; an F-Droid listing names no other store.`,
    );
  });

  it('passes words that only contain a store name', () => {
    const plain = listing('en-US').replace(
      /## Short description\n\n```text\n[^`]*```/u,
      '## Short description\n\n```text\nDios mío: a display of radios, playful and applied.\n```',
    );
    expect(mirror.fastlaneText('en-US', plain).short).toBe(
      'Dios mío: a display of radios, playful and applied.',
    );
  });

  it('uses the newest screenshot set at or below the version', () => {
    expect(mirror.screenshotVersion('0.3.7')).toBe('0.3.7');
    expect(mirror.screenshotVersion('0.3.9')).toBe('0.3.7');
    expect(mirror.screenshotVersion('0.3.6')).toBe('0.3.6');
    expect(mirror.screenshotVersion('0.3.5')).toBeNull();
    expect(mirror.screenshotVersion('0.1.0')).toBeNull();
  });

  // A bump writes store-assets/<version>/listing/ before anyone captures
  // screenshots for that version.
  it('passes over a version folder that holds no screenshots', () => {
    const assets = fs.mkdtempSync(path.join(os.tmpdir(), 'fdroid-assets-'));
    try {
      fs.mkdirSync(path.join(assets, '0.3.7', 'en-US', 'play-screenshots'), {
        recursive: true,
      });
      fs.mkdirSync(path.join(assets, '0.3.8', 'listing'), { recursive: true });
      expect(mirror.screenshotVersion('0.3.8', assets)).toBe('0.3.7');
    } finally {
      fs.rmSync(assets, { recursive: true, force: true });
    }
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

/**
 * The repository keeps its own copy of the Fastlane tree, because F-Droid's
 * RFP bot and its reviewers read the SourceCode repository, not the mirror.
 * When this fails, the listings or the version changed: run
 * `node tools/fdroid-mirror.js source` and commit the result.
 */
describe('this repository’s own fastlane/', () => {
  const root = path.join(__dirname, 'fastlane', 'metadata', 'android');
  let out: string;
  let generated: string[];

  beforeAll(() => {
    out = fs.mkdtempSync(path.join(os.tmpdir(), 'fastlane-source-'));
    const { versionName, versionCode } = mirror.currentVersion();
    generated = mirror.writeFastlane(out, versionCode, versionName);
  });

  afterAll(() => {
    fs.rmSync(out, { recursive: true, force: true });
  });

  it('numbers the version app.json declares', () => {
    const appJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'),
    ) as { expo: { version: string } };
    expect(mirror.currentVersion()).toStrictEqual(
      mirror.versionFromTag(`v${appJson.expo.version}`),
    );
  });

  it('matches what the listings generate, byte for byte', () => {
    const stale = generated.filter((file) => {
      const committed = path.join(__dirname, file);
      return (
        !fs.existsSync(committed) ||
        !fs.readFileSync(committed).equals(fs.readFileSync(path.join(out, file)))
      );
    });
    expect(stale).toStrictEqual([]);
  });

  // Older changelogs stay: F-Droid shows each one for the version it describes.
  it('holds nothing else but changelogs of earlier versions', () => {
    const { versionCode } = mirror.currentVersion();
    const extra = (fs.readdirSync(root, { recursive: true }) as string[])
      .map((file) => `fastlane/metadata/android/${file.split(path.sep).join('/')}`)
      .filter((file) => fs.statSync(path.join(__dirname, file)).isFile())
      .filter((file) => !generated.includes(file))
      .filter((file) => {
        const match = /\/changelogs\/(\d+)\.txt$/u.exec(file);
        return match === null || Number(match[1]) >= versionCode;
      });
    expect(extra).toStrictEqual([]);
  });
});

/**
 * The full policy describes crash reports, update checks and iOS speech
 * recognition. The mirror F-Droid reviews carries only the F-Droid section.
 */
describe('the build mirror’s PRIVACY.md', () => {
  const source = fs.readFileSync(path.join(__dirname, 'PRIVACY.md'), 'utf8');
  const policy = mirror.fdroidPrivacy(source);

  it('is the F-Droid section alone, under its own title and date', () => {
    expect(
      policy.startsWith('# Privacy Policy — OmniMorse (F-Droid build)\n\nLast updated: '),
    ).toBe(true);
    expect(policy).toContain('It has no internet permission, so it cannot');
    expect(policy).toContain('\n## What can leave your device\n');
    expect(policy).not.toMatch(/^###/mu);
    expect(policy).not.toContain('fdroid-policy');
    expect(policy.endsWith('<https://github.com/RogerioDoCarmo/morse_app>\n')).toBe(true);
  });

  it('carries nothing the F-Droid build does not have', () => {
    expect(policy).not.toMatch(/Crashlytics|Firebase|over-the-air|Send crash reports/u);
    expect(policy).not.toMatch(mirror.OTHER_STORES);
  });

  it('refuses a policy without exactly one marked section', () => {
    expect(() => mirror.fdroidPrivacy('# Policy\n\nLast updated: today.\n')).toThrow(
      'PRIVACY.md needs exactly one fdroid-policy start and end marker.',
    );
  });

  it('refuses an F-Droid section that names another store', () => {
    const named = source.replace(
      'Reading decoded text aloud',
      'Also on the App Store. Reading decoded text aloud',
    );
    expect(() => mirror.fdroidPrivacy(named)).toThrow(
      'The F-Droid policy names "App Store"; it names no other store.',
    );
  });

  it('is what the mirror ships instead of the full policy', () => {
    const script = fs.readFileSync(
      path.join(__dirname, 'tools', 'fdroid-assemble-mirror.sh'),
      'utf8',
    );
    expect(script).toContain('fdroid-mirror.js" privacy "$mirror_dir/PRIVACY.md"');
    expect(script).not.toMatch(/^\s+PRIVACY\.md$/mu);
  });
});
