import appJson from '../app.json';

import type * as AppVersion from './appVersion';

/**
 * The two shapes of the version line, one of which only a mock can reach.
 *
 * ⚠️ `APP_BUILD` is read from the native side at import time, so the only way
 * to see the app under a different build number — or none — is to swap the
 * module out and import `appVersion` again. Hence `resetModules` and `require`
 * rather than a top-level import: a static import would be evaluated once,
 * with whatever `jest-expo` happens to stand in, and neither branch below
 * would ever be exercised.
 *
 * The null branch is the one worth pinning. It is unreachable on a real phone
 * and looks like dead code, but without it a build that cannot answer would
 * render `0.3.4 (null)` on the About row — worse than saying nothing, because
 * a tester would quote it back as a build number.
 */
describe('the version a tester quotes', () => {
  afterEach(() => {
    jest.resetModules();
  });

  function versionWithBuild(nativeBuildVersion: string | null): string {
    jest.resetModules();
    jest.doMock('expo-application', () => ({ nativeBuildVersion }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('./appVersion') as typeof AppVersion).APP_VERSION_FULL;
  }

  it('names the binary: the version, then the build in brackets', () => {
    expect(versionWithBuild('13')).toBe(`${appJson.expo.version} (13)`);
  });

  it('is the version alone when there is no native side to ask', () => {
    expect(versionWithBuild(null)).toBe(appJson.expo.version);
  });

  it('never prints an empty bracket for a build of nothing', () => {
    expect(versionWithBuild(null)).not.toContain('(');
  });
});
