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
  it.each(['build:ipa:adhoc', 'build:ipa:adhoc:local'])('documents %s', (script) => {
    expect(COMMANDS).toContain(script);
  });
});
