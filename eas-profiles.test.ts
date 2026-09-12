// ⚠️ 0.3.2 and 0.3.3 both shipped to Firebase as Android versionCode 6.
//
// `appVersionSource: remote` means EAS holds the number and hands it to the
// build; `autoIncrement` decides whether it MOVES. Only `production` carried
// it, so every `preview` build — which is every build a tester ever installs —
// reused whatever the last production build left behind. Two different APKs
// then claim the same version code, and a phone asked to install the second
// over the first has no way to tell it is newer.
//
// Nothing fails when this is missing. The build succeeds, the upload succeeds,
// and the defect appears on someone's phone as "the fix isn't in here".
import * as fs from 'fs';
import * as path from 'path';

type Profile = Readonly<{ distribution?: string; autoIncrement?: boolean }>;

const easJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'eas.json'), 'utf8'),
) as Readonly<{ cli: Readonly<{ appVersionSource: string }>; build: Record<string, Profile> }>;

describe('eas build profiles', () => {
  /**
   * ⚠️ The literal names, not `Object.keys`. A test that asks the file which
   * profiles exist agrees with the file by construction — it would have passed
   * on the config that shipped the duplicate version code, and it would pass
   * again if someone deleted `preview` outright.
   */
  it.each(['preview', 'production'])('increments the build number for %s', (name) => {
    expect(easJson.build[name]?.autoIncrement).toBe(true);
  });

  /**
   * `development` is exempt and should stay that way: it installs over itself
   * on a developer's own device many times a day, and burning a version code
   * per run would put production thousands ahead for no reason.
   */
  it('leaves development alone', () => {
    expect(easJson.build['development']?.autoIncrement).toBeUndefined();
  });

  /**
   * ⚠️ `autoIncrement` only does anything while the number lives on EAS. Under
   * `appVersionSource: local` the value comes from `app.json` instead and this
   * flag is ignored silently — the profiles above would still read as correct
   * while every build reused whatever the file said.
   */
  it('keeps the version on EAS, which is what makes autoIncrement mean anything', () => {
    expect(easJson.cli.appVersionSource).toBe('remote');
  });
});
