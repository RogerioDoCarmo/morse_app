// App Store Connect wants two sets and refuses an app that declares tablet
// support without them. Nothing fails at capture time when one is missing —
// it is found at upload, which is the expensive place to find it.
import * as fs from 'fs';
import * as path from 'path';

const WORKFLOW = fs.readFileSync(
  path.join(__dirname, '.github', 'workflows', 'screenshots.yml'),
  'utf8',
);
const CAPTURE = fs.readFileSync(
  path.join(__dirname, 'tools', 'capture-ios-screenshots.sh'),
  'utf8',
);
const APP_JSON = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'),
) as {
  expo: { ios?: { supportsTablet?: boolean } };
};

describe('iOS screenshot capture', () => {
  /**
   * ⚠️ These two are a pair, and breaking the pair is the whole risk.
   *
   * `supportsTablet` is not an oversight here — the app has a NavRail instead
   * of a tab bar above a threshold width, and three `.tablet.test.tsx` files
   * behind it. While it declares tablet support, Apple requires a 13-inch iPad
   * screenshot set, and an app that stops capturing one has to stop declaring
   * the other in the same change.
   */
  it('captures an iPad set for as long as it claims to support tablets', () => {
    if (APP_JSON.expo.ios?.supportsTablet !== true) return;
    expect(WORKFLOW).toContain('screenshots-ipad');
    expect(WORKFLOW).toMatch(/iPad Pro 13-inch/u);
  });

  it('captures a 6.9-inch iPhone set as well', () => {
    expect(WORKFLOW).toContain('screenshots-ios');
    expect(WORKFLOW).toMatch(/iPhone 17 Pro Max/u);
  });

  it.each(['store-screenshots-ios', 'store-screenshots-ipad'])(
    'uploads %s so the set can actually be collected',
    (artifact) => {
      expect(WORKFLOW).toContain(artifact);
    },
  );

  /**
   * ⚠️ Maestro writes into its own directory under ~/.maestro/tests and this
   * script runs more than once per job. Without clearing it, the second
   * capture collects the first one's images too — and the iPad artifact
   * quietly contains iPhone screenshots, at iPhone dimensions, which Apple
   * rejects for the iPad slot.
   */
  it('clears Maestro output between captures', () => {
    expect(CAPTURE).toContain('rm -rf "$HOME/.maestro/tests"');
    expect(CAPTURE.indexOf('rm -rf "$HOME/.maestro/tests"')).toBeLessThan(
      CAPTURE.indexOf('maestro --device'),
    );
  });

  /**
   * ⚠️ A LITERAL match, not a regex. The inline version this replaced
   * interpolated the device name into an awk pattern — fine for "iPhone 17 Pro
   * Max", silently wrong for "iPad Pro 13-inch (M4)", whose parentheses are a
   * regex group. It would have matched nothing and fallen through.
   */
  it('matches simulator names literally', () => {
    expect(CAPTURE).toContain('grep -F "$want"');
  });

  /**
   * ⚠️ And on a PREFIX, so a chip revision cannot break it.
   *
   * The first run asked for "iPad Pro 13-inch (M4)" on a runner that had
   * "iPad Pro 13-inch (M5)" and found nothing. The chip is not the part that
   * decides the screen size, so it is not the part to match on.
   */
  it.each(['iPad Pro 13-inch', 'iPad Air 13-inch'])(
    'asks for %s without pinning a chip revision',
    (name) => {
      expect(WORKFLOW).toContain(`"${name}"`);
      expect(WORKFLOW).not.toContain(`"${name} (M`);
    },
  );

  /**
   * ⚠️ A GREEN RUN WITH AN EMPTY REQUIRED ARTIFACT is the failure mode this
   * whole file exists to prevent.
   *
   * The first run captured no iPad at all and reported SUCCESS, because the
   * check only looked at the iPhone directory. That is the same shape as the
   * Android screenshots sitting at 320x640 for a week — a green tick over a
   * missing or wrong asset, discovered at upload.
   */
  it('fails the job when tablet support is declared but no iPad set exists', () => {
    if (APP_JSON.expo.ios?.supportsTablet !== true) return;
    // The guard itself, not a mention of it — an earlier version of this test
    // passed on the word `supportsTablet` appearing in a COMMENT, which is a
    // tidy demonstration of the thing it is meant to catch.
    expect(WORKFLOW).toContain(
      'node -e "process.exit(require(\'./app.json\').expo.ios.supportsTablet ? 0 : 1)"',
    );
    expect(WORKFLOW).toContain('Apple requires an iPad set');
  });

  // The dimensions are reported, not assumed. A full set of Android
  // screenshots reached the listing at 320x640 because nobody measured.
  it('prints the dimensions it captured', () => {
    expect(CAPTURE).toContain('pixelWidth');
  });
});
