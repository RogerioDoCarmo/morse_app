// The signing profile decides which channel an iOS build can reach, and the
// two are mutually exclusive. Picking the wrong script costs a whole build and
// fails at INSTALL time, on a tester's phone, rather than at build time.
import * as fs from 'fs';
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
