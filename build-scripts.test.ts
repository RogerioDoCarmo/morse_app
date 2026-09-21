// The signing profile decides which channel an iOS build can reach, and the
// two are mutually exclusive. Picking the wrong script costs a whole build and
// fails at INSTALL time, on a tester's phone, rather than at build time.
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const scripts = (
  JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  }
).scripts;

const COMMANDS = fs.readFileSync(path.join(__dirname, 'COMMANDS.md'), 'utf8');

/** The profile a build script asks EAS for. */
function profileOf(script: string): string | undefined {
  return /--profile (\w+)/u.exec(scripts[script] ?? '')?.[1];
}

describe('build scripts', () => {
  /**
   * ⚠️ `production` is App Store signed: TestFlight takes it and Firebase App
   * Distribution CANNOT INSTALL IT AT ALL. `preview` is ad-hoc: the reverse.
   *
   * Every `build:ipa*` script used to be `production`, so the documented local
   * iOS path could not reach Firebase by any route — which was only discovered
   * by needing it.
   */
  it.each([
    ['build:ipa', 'production'],
    ['build:ipa:local', 'production'],
    ['build:ipa:adhoc', 'preview'],
    ['build:ipa:adhoc:local', 'preview'],
  ])('%s asks for the %s profile', (script, profile) => {
    expect(profileOf(script)).toBe(profile);
  });

  // Android's pair has always been right; this keeps it that way.
  it.each([
    ['build:apk', 'preview'],
    ['build:aab', 'production'],
  ])('%s asks for the %s profile', (script, profile) => {
    expect(profileOf(script)).toBe(profile);
  });

  /**
   * Every remote script has a `:local` twin. The local ones are what get used
   * while EAS build credits are exhausted, and a missing twin is only noticed
   * at the moment it is needed.
   */
  it.each(['build:apk', 'build:aab', 'build:ipa', 'build:ipa:adhoc'])(
    '%s has a :local twin that differs only by --local',
    (script) => {
      expect(scripts[`${script}:local`]).toBe(`${scripts[script]} --local`);
    },
  );

  // A script nobody can find is a script nobody uses.
  it.each(['build:ipa:adhoc', 'build:ipa:adhoc:local', 'submit:ios'])(
    'documents %s',
    (script) => {
      expect(COMMANDS).toContain(script);
    },
  );

  /**
   * ⚠️ `submit:ios` must not become an `eas submit` wrapper without someone
   * deciding to. EAS submits through a shared queue that sat on "waiting for
   * an available submitter" long enough to be abandoned on 12 September;
   * altool uploads directly. Both are legitimate, but the script is the direct
   * one and the difference is the reason it exists.
   */
  it('submits with altool rather than through the EAS queue', () => {
    expect(scripts['submit:ios']).toBe('tools/submit-ios.sh');
    const script = fs.readFileSync(path.join(__dirname, 'tools/submit-ios.sh'), 'utf8');
    expect(script).toContain('altool --upload-app');
    // The password goes in by reference, never as an argument altool's process
    // line would carry.
    expect(script).toContain("'@env:ALTOOL_PW'");
    // And an ad-hoc build is refused before the upload is spent.
    expect(script).toContain('ProvisionedDevices');
  });
});

/**
 * ⚠️ THE LAST DEPENDABOT ALERT, AND IT WAS FIXABLE AFTER ALL.
 *
 * `uuid` reaches this project as `expo/config-plugins` → `xcode` → `uuid`, and
 * its only patched version (11.1.1) is ESM-only. The first attempt at the
 * override was abandoned because three config-plugin suites died with
 * "Unexpected token 'export'" — jest cannot parse ESM without a transform, and
 * punching a hole in jest to clear a badge looked like the worse trade.
 *
 * ⚠️ But this project ALREADY maintains a `transformIgnorePatterns` exception
 * list for exactly that, with a dozen packages in it. `uuid` sits beside
 * `react-native` and `expo`, which are there for the same reason. It is the
 * existing mechanism, not a new hole.
 *
 * ⚠️ And the check that mattered was never the tests. `xcode` uses uuid to
 * write `project.pbxproj` during `expo prebuild` — had ESM broken it there,
 * EVERY build would break, silently, until the next one was attempted.
 * Verified on both platforms before this was kept: iOS wrote a valid pbxproj
 * and an Info.plist at 0.3.5; Android wrote a manifest with all nine
 * permissions.
 */
describe('the uuid override, which closes the last alert', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'),
  ) as { pnpm?: { overrides?: Record<string, string> } };
  const jestConfig = fs.readFileSync(path.join(__dirname, 'jest.config.js'), 'utf8');

  // The patched version as a literal — the advisory is `< 11.1.1`, and the
  // tree carried 7.0.3 through `xcode`.
  it('pins uuid at the patched version', () => {
    expect(pkg.pnpm?.overrides?.['uuid@7']).toBe('^11.1.1');
  });

  it('lets jest transform it, since 11.x is ESM-only', () => {
    expect(jestConfig).toContain('|uuid))');
  });

  /**
   * ⚠️ The app must never import it. This is a BUILD-TIME dependency of a
   * config plugin, which runs on a build machine and never ships in the
   * binary — an app import would change that, and would be the one thing that
   * turns a build-machine advisory into a shipped one.
   */
  it('is not imported anywhere in the app', () => {
    const appFiles = fs
      .readdirSync(path.join(__dirname, 'src'), { recursive: true })
      .filter((f): f is string => typeof f === 'string' && /\.(ts|tsx)$/u.test(f))
      .map((f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8'));
    const importsUuid = appFiles.filter((body) =>
      /from 'uuid'|require\('uuid'\)/u.test(body),
    );
    expect(importsUuid).toHaveLength(0);
  });
});

/**
 * ⚠️ `tools/patch-android-release.js` exists because this machine cannot run
 * `eas build --local` at all — EAS refuses Windows outright — and EAS cloud
 * credits do not reset until 1 October. Gradle runs natively, so the AAB is
 * still buildable, but three things EAS does inside its builder have to be
 * done by hand, and the worst one is silent:
 *
 * The Expo template ships `release { signingConfig signingConfigs.debug }`.
 * A debug-signed AAB builds, uploads, and is REFUSED by Play, because its
 * certificate is not the upload certificate Play holds. Nothing local catches
 * that — the file looks perfectly good until the console rejects it.
 */
describe('patch-android-release.js', () => {
  const version = (
    JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8')) as {
      expo: { version: string };
    }
  ).expo.version;

  /** The shape prebuild produces, reduced to the parts the script rewrites. */
  const template = (versionName: string): string =>
    [
      'android {',
      '    defaultConfig {',
      '        versionCode 1',
      `        versionName "${versionName}"`,
      '    }',
      '    signingConfigs {',
      '        debug {',
      "            storeFile file('debug.keystore')",
      "            storePassword 'android'",
      '        }',
      '    }',
      '    buildTypes {',
      '        debug {',
      '            signingConfig signingConfigs.debug',
      '        }',
      '        release {',
      '            // Caution! In production, you need to generate your own keystore file.',
      '            signingConfig signingConfigs.debug',
      '            minifyEnabled enableMinifyInReleaseBuilds',
      '        }',
      '    }',
      '}',
      '',
    ].join('\n');

  function run(gradle: string, code: string): { status: number; text: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'morse-gradle-'));
    const file = path.join(dir, 'build.gradle');
    fs.writeFileSync(file, gradle);
    let status = 0;
    try {
      execFileSync(
        process.execPath,
        [path.join(__dirname, 'tools', 'patch-android-release.js'), code],
        {
          env: { ...process.env, MORSE_GRADLE_FILE: file },
          stdio: 'pipe',
        },
      );
    } catch {
      status = 1;
    }
    return { status, text: fs.readFileSync(file, 'utf8') };
  }

  it('stops the release build being signed with the debug keystore', () => {
    const { status, text } = run(template(version), '14');

    expect(status).toBe(0);
    // The release block, and only the release block, moves to the upload key.
    expect(text).toMatch(/release \{[\s\S]*?signingConfig signingConfigs\.upload/u);
    expect(text).not.toMatch(/release \{[\s\S]*?signingConfig signingConfigs\.debug/u);
  });

  // ⚠️ Repointing the debug config instead of adding a new one would make every
  // local install fail on a signature mismatch against what is on the device.
  it('leaves debug builds on the debug keystore', () => {
    const { text } = run(template(version), '14');

    expect(text).toMatch(/debug \{\n\s*signingConfig signingConfigs\.debug/u);
    expect(text).toContain("storePassword 'android'");
  });

  it('writes the versionCode it was given, since prebuild always writes 1', () => {
    const { text } = run(template(version), '14');

    expect(text).toContain('versionCode 14');
    expect(text).not.toContain('versionCode 1\n');
  });

  // The passwords belong to Gradle, which opens the properties file itself.
  it('never writes a secret into android/', () => {
    const { text } = run(template(version), '14');

    expect(text).toContain("keystoreProperties['storePassword']");
    expect(text).toContain('MORSE_KEYSTORE_PROPERTIES');
  });

  // ⚠️ android/ is gitignored, so nothing else in the repository notices when
  // it is a version behind — and a stale one silently ships the old native
  // config under the new version's name.
  it('refuses a stale android/ rather than patching it', () => {
    const { status } = run(template('0.0.1-stale'), '14');

    expect(status).toBe(1);
  });

  it('accepts being run again with a different versionCode', () => {
    const once = run(template(version), '14');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'morse-gradle-again-'));
    const file = path.join(dir, 'build.gradle');
    fs.writeFileSync(file, once.text);
    execFileSync(
      process.execPath,
      [path.join(__dirname, 'tools', 'patch-android-release.js'), '15'],
      {
        env: { ...process.env, MORSE_GRADLE_FILE: file },
        stdio: 'pipe',
      },
    );

    expect(fs.readFileSync(file, 'utf8')).toContain('versionCode 15');
  });
});

/**
 * ⚠️ EVERY SHELL SCRIPT IN `tools/` MUST BE EXECUTABLE IN GIT, and on Windows
 * that does not happen by itself.
 *
 * This machine has `core.filemode=false`, so `chmod +x` is recorded as nothing.
 * Every script written on the Mac is mode 100755; the two written on Windows
 * were committed 100644 and neither `git status` nor any check said a word.
 *
 * `capture-android-locales.sh` then failed in CI with
 * `/usr/bin/sh: 1: tools/capture-android-locales.sh: Permission denied` — after
 * building the app and booting an emulator, seven minutes in.
 * `build-aab-local.sh` had the same defect and had simply never been run the
 * way its own header documents.
 *
 * The fix is `git update-index --chmod=+x <file>`; this is the guard that says
 * when it was forgotten.
 */
describe('shell scripts are executable in the index', () => {
  /** `<mode> <sha> <stage>\t<path>` for every tracked file under tools/. */
  const entries = execFileSync('git', ['ls-files', '-s', 'tools'], {
    cwd: __dirname,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const [meta, file] = line.split('\t');
      return { mode: (meta as string).split(' ')[0] as string, file: file as string };
    });

  const scripts = entries.filter((e) => e.file.endsWith('.sh'));

  it('finds the scripts it is checking', () => {
    // Without this a change to the path or to `ls-files` would make the
    // assertion below vacuously true.
    expect(scripts.length).toBeGreaterThanOrEqual(8);
  });

  it('records every .sh as mode 100755', () => {
    const notExecutable = scripts.filter((s) => s.mode !== '100755').map((s) => s.file);

    expect(notExecutable).toEqual([]);
  });
});

/**
 * ⚠️ THIS IS THE CHECK THAT WOULD HAVE CAUGHT THE BLANK TABLET SCREENSHOTS.
 *
 * Every welcome slide on the 10-inch, Chromebook and iPad slots shipped with
 * the SOS illustration missing, in three languages, on both stores. The images
 * had the right names, the right count, the right dimensions and the right
 * text; the only thing wrong with them was a picture that was not there. No
 * unit test could see it -- React Native Testing Library resolves the tree
 * without laying anything out, so `getByTestId` passes on a zero-height
 * element, and all 35 FirstRun tests were green throughout.
 *
 * So the check is on the pixels, and these tests are on the check. They feed
 * the measurement raw bytes rather than a PNG, because ubuntu-latest has no
 * ffmpeg and a test that needed one would have skipped in CI -- which is the
 * same kind of nothing as the tests that already passed.
 */
describe('measure-left-band-ink.py', () => {
  const MEASURE = path.join(__dirname, 'tools', 'measure-left-band-ink.py');
  const W = 200;
  const H = 100;

  /** Runs the measurement over a frame built by `paint`. */
  function ink(diff: number, paint: (frame: Buffer) => void): number {
    // 246 is the app's actual near-white ground, the value both the broken and
    // the fixed captures measure as their background.
    const frame = Buffer.alloc(W * H, 246);
    paint(frame);
    return Number(
      execFileSync('python3', [MEASURE], {
        input: frame,
        env: { ...process.env, WIDTH: String(W), HEIGHT: String(H), DIFF: String(diff) },
      })
        .toString()
        .trim(),
    );
  }

  /** Fills a rectangle, in fractions of the frame, with one grey value. */
  const rect =
    (x0: number, x1: number, y0: number, y1: number, value: number) =>
    (frame: Buffer) => {
      for (let y = Math.round(y0 * H); y < Math.round(y1 * H); y += 1) {
        frame.fill(value, y * W + Math.round(x0 * W), y * W + Math.round(x1 * W));
      }
    };

  it('reports exactly zero for a uniform frame, which is what the broken captures measure', () => {
    expect(ink(8, () => {})).toBe(0);
  });

  it('ignores art outside the band, because the right column is only ever copy', () => {
    // The full height of the RIGHT half: this is where the title, body and
    // Next button live, and they must not be mistaken for the illustration.
    expect(ink(8, rect(0.5, 1, 0, 1, 0))).toBe(0);
  });

  it('ignores art above the band, where a single-column layout puts its art', () => {
    expect(ink(8, rect(0, 0.45, 0, 0.19, 0))).toBe(0);
  });

  /**
   * ⚠️ THE NUMBER THAT WAS WRONG THE FIRST TIME. The illustration is a white
   * card on the near-white ground -- 255 against 246, nine levels apart. A
   * threshold of 12, which sounds conservative, steps straight over the card
   * and scored a CORRECTLY RENDERED tablet capture at 0.0065: blank, said the
   * check, about an image with the picture plainly in it.
   */
  it.each([
    [2, 1],
    [4, 1],
    [6, 1],
    [8, 1],
    [12, 0],
  ])('at diff=%d the white card counts as %d of the band', (diff, expected) => {
    expect(ink(diff, rect(0, 0.45, 0.2, 0.8, 255))).toBe(expected);
  });

  it('excludes a pixel exactly DIFF from the background, not just beyond it', () => {
    expect(ink(8, rect(0, 0.45, 0.2, 0.8, 246 - 8))).toBe(0);
    expect(ink(8, rect(0, 0.45, 0.2, 0.8, 246 - 9))).toBe(1);
  });

  /**
   * ⚠️ THE INVERSION GUARD, and the reason the background is taken from the
   * WHOLE FRAME rather than from the band.
   *
   * Measured against the band's own commonest value, art covering more than
   * half the band becomes the background itself: the ground around it is then
   * counted as the "art", and a band filled edge to edge with illustration
   * measures ZERO -- indistinguishable from a blank one, for exactly the
   * opposite reason. These two pin the behaviour at 90% and at 100%.
   */
  it('reads heavy art as art rather than adopting it as the background', () => {
    expect(ink(8, rect(0, 0.45, 0.2, 0.74, 255))).toBe(0.9);
  });

  it('reads a band filled edge to edge as entirely art, not as empty', () => {
    expect(ink(8, rect(0, 0.45, 0.2, 0.8, 255))).toBe(1);
  });
});
