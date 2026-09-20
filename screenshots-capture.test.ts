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

/**
 * ⚠️ PLAY REJECTED A WHOLE CHROMEBOOK SET OVER 0.0006.
 *
 * The slot's rule is "proporção 16:9 ou 9:16, cada lado medindo entre 1.080 e
 * 7.680 px", and it means 16:9 exactly. The workflow padded to
 * `ceil(ih*16/9/2)*2`, which cannot be exact unless the height is a multiple
 * of 9 — a 1480px-tall capture became 2632x1480 = 1.7784 — and the workflow's
 * own guard allowed `abs(ratio - 16/9) > 0.02`, so it certified the set and
 * the store refused it.
 *
 * A guard looser than the store it guards against is worse than no guard,
 * because it is believed. These tests pin both halves of that fix.
 */
describe('the Chromebook slot, which Play measures exactly', () => {
  it('pads onto a fixed 2560x1440 canvas, not a computed width', () => {
    expect(WORKFLOW).toContain('pad=2560:1440');
  });

  // 2560x1440 asserted as the literal it is: it is exactly 16:9, and both
  // sides sit inside 1080-7680. Arithmetic on the constant would agree with
  // whatever the constant became.
  it('uses a canvas that is exactly 16:9 and inside Play limits', () => {
    const [w, h] = [2560, 1440];
    expect(w * 9).toBe(h * 16);
    expect(Math.min(w, h)).toBeGreaterThanOrEqual(1080);
    expect(Math.max(w, h)).toBeLessThanOrEqual(7680);
  });

  /**
   * ⚠️ Every pixel of the app survives. `decrease` fits the capture inside the
   * canvas and the pad fills the rest with `ground`; a crop would cut a screen
   * whose content reaches the edges.
   */
  it('fits the capture inside the canvas rather than cropping it', () => {
    expect(WORKFLOW).toContain('force_original_aspect_ratio=decrease');
  });

  it('checks the ratio exactly, by integer arithmetic', () => {
    expect(WORKFLOW).toContain('w * 9 != h * 16');
  });

  // The tolerance that let the rejected set through. Asserting its ABSENCE is
  // the only way this stays fixed — the guard passed, so nothing else would
  // have noticed it come back.
  it('no longer allows a tolerance around 16:9', () => {
    expect(WORKFLOW).not.toContain('abs(ratio - 16 / 9) > 0.02');
  });

  it('enforces Play’s 1080-7680 range for this slot', () => {
    expect(WORKFLOW).toContain('outside Play 1080-7680px');
  });
});

/**
 * ⚠️ THE 6.5-INCH SLOT CANNOT BE CAPTURED AT ALL. Xcode 26 ships no 6.5-inch
 * simulator — XS Max, 11 Pro Max and 12/13 Pro Max are all gone — so 1284x2778
 * comes from converting the 6.9-inch capture or it does not come at all.
 *
 * ⚠️ It used to live as a SENTENCE. BEFORE-THE-DROP-OFF said the set was
 * recoverable "only if someone remembers the conversion, which is scaling on
 * height and padding 5px". A recipe nobody can run is one bad week from being
 * lost, so it is a script now, and these pin the numbers in it.
 */
describe('deriving the 6.5-inch iPhone set, which no simulator can capture', () => {
  const DERIVE = fs.readFileSync(
    path.join(__dirname, 'tools', 'derive-iphone-65.sh'),
    'utf8',
  );

  // The four sizes, as literals. Reading them back out of the script would
  // agree with whatever the script said, including a typo.
  it('converts 1320x2868 into 1284x2778', () => {
    expect(DERIVE).toContain('SRC_W=1320 SRC_H=2868');
    expect(DERIVE).toContain('DST_W=1284 DST_H=2778');
  });

  /**
   * ⚠️ Scaling on HEIGHT is the whole recipe. The slots differ by 0.4% in
   * shape, so height-first lands the width at 1278.58 → 1279 and leaves 5px
   * for `ground`. Scaling on width instead would overshoot the height and
   * force a crop, which takes content off a screen that reaches its edges.
   */
  it('scales on height and pads the remainder', () => {
    expect(DERIVE).toContain('scale=-1:${DST_H}');
    expect(DERIVE).toContain('pad=${DST_W}:${DST_H}');
  });

  it('pads with the app’s ground colour, not black', () => {
    expect(DERIVE).toContain('GROUND=0xf2f4f7');
  });

  /**
   * ⚠️ It refuses a source that is not the 6.9-inch capture. Deriving from the
   * wrong size yields files of the RIGHT dimensions at the WRONG content
   * scale, which nothing downstream would catch — App Store Connect measures
   * the frame, not what is drawn in it.
   */
  it('refuses a source that is not the 6.9-inch capture', () => {
    expect(DERIVE).toContain('expected ${SRC_W}x${SRC_H} (6.9-inch)');
  });

  it('verifies what it produced rather than trusting ffmpeg', () => {
    expect(DERIVE).toContain('expected ${DST_W}x${DST_H}');
  });
});

/**
 * ⚠️ PLAY CONSOLE DOES NOT SORT A MULTI-FILE UPLOAD THE WAY THE FILENAMES DO.
 *
 * The captures were `00-welcome`, `01-translator`, `02-output-channels` … and
 * they arrived at the console shuffled, leaving someone to drag seven
 * near-identical phone screenshots back into an order they had to guess. The
 * numbers looked like they were doing the job and were not.
 *
 * Letters survive that ordering, which is the whole reason for the naming.
 */
describe('screenshot names carry their own upload order', () => {
  const FLOW = fs.readFileSync(
    path.join(__dirname, '.maestro', 'screenshots.yaml'),
    'utf8',
  );

  /** Capture names, in the order the flow takes them. */
  const names = [...FLOW.matchAll(/^- takeScreenshot:\s*(\S+)\s*$/gmu)].map(
    (m) => m[1] as string,
  );

  it('finds the captures it is reasoning about', () => {
    // Without this, a rename of the YAML key would make every assertion below
    // vacuously true.
    expect(names.length).toBeGreaterThanOrEqual(6);
  });

  it('prefixes every shot with a single letter', () => {
    const wrong = names.filter((n) => !/^[a-z]-/u.test(n));

    expect(wrong).toEqual([]);
  });

  // ⚠️ The failure this prevents is subtle: a numbered name still sorts
  // correctly in a shell and in git, so nothing local complains. It only shows
  // up in the console, after the upload.
  it('leaves no numeric prefix behind', () => {
    const numbered = names.filter((n) => /^\d/u.test(n));

    expect(numbered).toEqual([]);
  });

  it('puts them in alphabetical order, so upload order matches capture order', () => {
    expect(names).toStrictEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  // Play takes 2–8 phone screenshots. Six is comfortable; the guard is against
  // someone trimming the set below what the store will accept.
  it('keeps enough shots for the store to accept the listing', () => {
    expect(names.length).toBeGreaterThanOrEqual(2);
    expect(names.length).toBeLessThanOrEqual(8);
  });
});

/**
 * ⚠️ THE COLLECTORS HAVE TO MATCH THE NAMES, and nothing else checks that.
 *
 * Both the workflow and the iOS script fish the captures out of Maestro's own
 * debug directory with a `find -name` glob. Both read `[0-9][0-9]-*.png`, which
 * matched nothing the moment the shots were renamed `a-` … `f-`. The failure
 * mode is the expensive kind: the emulator boots, the app builds, the flow runs
 * its full twenty minutes and produces every image — and then the collector
 * reports that none were produced.
 *
 * The screenshots workflow is `workflow_dispatch` only, so no PR would have
 * caught it either.
 */
describe('the collectors find the names the flow writes', () => {
  const FLOW = fs.readFileSync(
    path.join(__dirname, '.maestro', 'screenshots.yaml'),
    'utf8',
  );
  const shots = [...FLOW.matchAll(/^- takeScreenshot:\s*(\S+)\s*$/gmu)].map(
    (m) => m[1] as string,
  );

  /** The `find -name '<glob>'` pattern used by a collector. */
  function globsIn(source: string): string[] {
    return [...source.matchAll(/-name\s+'([^']+\.png)'/gu)].map((m) => m[1] as string);
  }

  /**
   * A shell glob as `find` reads it: `[a-z]` stays a character class, `*`
   * becomes any run, and a literal dot is written `[.]` — which escapes it
   * without a backslash, so this line survives being moved between a shell
   * heredoc and a file. The first version used backslash escapes and arrived
   * with them collapsed, leaving an unterminated regex.
   */
  function toRegExp(glob: string): RegExp {
    const escaped = glob.split('.').join('[.]').split('*').join('.*');
    return new RegExp('^' + escaped + '$', 'u');
  }

  it('finds a collector in each file, and captures to check it against', () => {
    expect(globsIn(WORKFLOW).length).toBeGreaterThan(0);
    expect(globsIn(CAPTURE).length).toBeGreaterThan(0);
    expect(shots.length).toBeGreaterThanOrEqual(6);
  });

  it('matches every capture from the workflow', () => {
    const globs = globsIn(WORKFLOW);
    const missed = shots.filter((s) => !globs.some((g) => toRegExp(g).test(s + '.png')));

    expect(missed).toEqual([]);
  });

  it('matches every capture from the iOS script', () => {
    const globs = globsIn(CAPTURE);
    const missed = shots.filter((s) => !globs.some((g) => toRegExp(g).test(s + '.png')));

    expect(missed).toEqual([]);
  });

  // The negative control: proves the two assertions above are doing work
  // rather than passing on a glob that happens to match anything.
  it('would reject the numbered names these globs used to expect', () => {
    for (const glob of globsIn(WORKFLOW).concat(globsIn(CAPTURE))) {
      expect(toRegExp(glob).test('00-welcome.png')).toBe(false);
    }
  });
});
