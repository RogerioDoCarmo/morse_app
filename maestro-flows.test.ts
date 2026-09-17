// Maestro flows are YAML that nothing type-checks and that only CI ever runs,
// twenty minutes at a time. These tests hold the two things about
// audio-playback.yaml that broke it, so a mistake in either costs six seconds
// here instead of a red run on develop.
import * as fs from 'fs';
import * as path from 'path';

import { encode } from '@/core/domain/morse';
import { PLAYBACK_WPM_CHOICES } from '@/core/domain/settings';
import { toTimeline, unitMsForWpm } from '@/core/domain/timeline';

const FLOW = path.join(__dirname, '.maestro', 'flows', 'audio-playback.yaml');
const flow = fs.readFileSync(FLOW, 'utf8');

const DISMISS = path.join(__dirname, '.maestro', 'dismiss-first-run.yaml');
const dismiss = fs.readFileSync(DISMISS, 'utf8');

/**
 * The wall-clock cost of the flow's longest section on the CI simulator,
 * measured from the recording of the run that failed: a tap that starts the
 * run (12.1s), an assertion (0.3s), a tap on a letter mid-message (21.7s) and
 * a second assertion. The message has to outlive all of it.
 */
const LONGEST_SECTION_MS = 34_000;

/**
 * How much text the input may hold before it crowds the output off the screen.
 *
 * The input card cannot shrink and the Morse card absorbs every shortfall, so
 * on a 320dp emulator a few lines of text squeezed the dots and dashes out of
 * the view hierarchy altogether. Fifteen characters rendered as one line
 * there; twice that filled the screen. Kept generous enough for the tail
 * `eraseText` leaves behind.
 */
const MAX_TYPED_CHARACTERS = 26;

type Tap = { id: string; skipsSettle: boolean };

/**
 * The taps, in order. A hand-rolled scan rather than a YAML dependency added
 * for one test — a `tapOn` block here is always `- tapOn:` followed by its
 * indented keys, and check-syntax already validates the file as YAML.
 */
function taps(source: string): Tap[] {
  const lines = source.split('\n');
  const found: Tap[] = [];

  lines.forEach((line, index) => {
    if (line.trimEnd() !== '- tapOn:') return;

    const body: string[] = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      if (!lines[next]?.startsWith('    ')) break;
      body.push(lines[next] as string);
    }

    const id = /id:\s*'([^']+)'/.exec(body.join('\n'))?.[1];
    if (id !== undefined) {
      found.push({
        id,
        skipsSettle: body.some((entry) => /waitToSettleTimeoutMs:\s*0\s*$/.test(entry)),
      });
    }
  });

  return found;
}

describe('audio-playback.yaml', () => {
  /** The speed the flow picks in Settings before it types anything. */
  const chosenWpm = Number(/id:\s*'segment-(\d+)'/.exec(flow)?.[1]);
  /** The message it then types. */
  const typed = /inputText:\s*'([^']+)'/.exec(flow)?.[1];

  it('picks a speed the Settings screen actually offers', () => {
    expect(PLAYBACK_WPM_CHOICES).toContain(chosenWpm);
  });

  // Every section starts a run, does something to it, and stops it. If the
  // message ends first the section's own assertions start failing, which is
  // what "Assertion is false: id: playback-progress is visible" meant — the
  // run had finished two seconds before the assertion opened.
  it('types a message that outlasts the longest section twice over', () => {
    expect(typed).toBeDefined();

    const units = toTimeline(encode(typed as string)).totalUnits;

    expect(units * unitMsForWpm(chosenWpm)).toBeGreaterThan(LONGEST_SECTION_MS * 2);
  });

  // The other half of the same constraint, and the one that is easy to break
  // while fixing the first: buying duration with characters costs the output
  // pane its height. Twenty SOS bought 81 seconds and cost the flow both
  // platforms — Android lost the letter chips, iOS lost the keyboard dismiss.
  it('buys that duration with speed rather than with characters', () => {
    expect((typed as string).length).toBeLessThanOrEqual(MAX_TYPED_CHARACTERS);
  });

  // The speed above is set through the UI, so the flow has to start from
  // cleared state — otherwise it would be reading whatever a previous run left
  // behind rather than what it just chose.
  it('launches from cleared state, so its own choices are the ones in play', () => {
    expect(flow).toMatch(/launchApp:\s*\n\s*clearState:\s*true/);
  });

  /**
   * A tap has to skip Maestro's settle wait exactly when it leaves a message
   * playing. This app animates a progress bar, a clock and the lit letter for
   * the whole run, so the hierarchy never stops changing and the wait runs to
   * its full timeout: 11.6-12.1s per tap on CI, and 21.7s for the tap on a
   * letter mid-message, against assertions that cost 0.3s each.
   *
   * The stop taps keep the wait deliberately. They leave the app still, so it
   * costs nothing and it is the one place a settle check still earns its keep.
   */
  it('skips the settle wait on exactly the taps that leave a message playing', () => {
    let playing = false;
    const wrong: string[] = [];

    taps(flow).forEach((tap, index) => {
      if (tap.id === 'signal-button') playing = !playing;
      if (tap.skipsSettle !== playing) {
        wrong.push(`${index}: ${tap.id} (playing after: ${String(playing)})`);
      }
    });

    expect(wrong).toStrictEqual([]);
  });

  // Guards the scan above: a rename that stopped it finding anything would
  // make every assertion in this file vacuously true. The counts are also a
  // deliberate speed bump — a section added or removed lands here first, and
  // the settle rule above is only worth anything if the scan can see it.
  it('finds the taps it is reasoning about', () => {
    const found = taps(flow);

    expect(found.filter((tap) => tap.id === 'signal-button')).toHaveLength(12);
    expect(found.filter((tap) => tap.skipsSettle)).toHaveLength(8);
  });

  /**
   * A message long enough to outlast a section is about fourteen rows of chips
   * on a 320dp screen, so anything at the FOOT of the Morse card is below the
   * region the cards scroll in. The Android run said so plainly:
   * `playing-badge`, in the card's head, visible in 0.5s; `playback-progress`,
   * then in its foot, not found after 18.9 seconds of looking.
   *
   * The progress bar and clock have since moved out of the card altogether and
   * are pinned above the channel strip, so they need no scrolling. What is
   * left in the foot is `morse-string`, and it may only be asserted where the
   * flow has scrolled to it.
   */
  it('only looks for the card footer where it has scrolled to it', () => {
    const footer = /id: 'morse-string'/g;
    const scrolled = flow.indexOf('scrollUntilVisible');

    expect(scrolled).toBeGreaterThan(-1);
    for (const match of flow.matchAll(footer)) {
      expect(match.index).toBeGreaterThan(scrolled);
    }
  });
});

/**
 * Six flows start by running this one, so a mistake here does not fail here —
 * it fails six flows later, on whatever screen they thought they were on.
 */
describe('dismiss-first-run.yaml', () => {
  // Skip used to jump to the last slide, which meant leaving took a tap on
  // Skip and then a tap on Start. It now leaves outright, and a leftover
  // second tap would land on the Translator underneath.
  it('leaves the guide in exactly one tap', () => {
    expect(taps(dismiss).map((tap) => tap.id)).toStrictEqual(['first-run-skip']);
  });

  it('checks it actually left, rather than trusting the tap', () => {
    expect(dismiss).toMatch(/assertNotVisible:\s*\n\s*id: 'first-run'/);
  });
});

/**
 * ⚠️ A `hideKeyboard` with nothing to dismiss is NOT harmless.
 *
 * Maestro goes looking for somewhere to tap and takes the app with it —
 * `screenshots.yaml` lost a run to exactly that, arriving at a screen where
 * the next id no longer existed. Three of these were in the suite purely
 * because the Translator used to focus its input on open; when that went, they
 * became live traps.
 *
 * So: every dismissal must follow something that actually raises a keyboard.
 */
describe('keyboard dismissals', () => {
  const flowFiles = (): string[] => {
    const roots = [
      path.join(__dirname, '.maestro'),
      path.join(__dirname, '.maestro', 'flows'),
      path.join(__dirname, '.maestro', 'video'),
    ];
    return roots.flatMap((dir) =>
      fs
        .readdirSync(dir)
        .filter((name) => name.endsWith('.yaml'))
        .map((name) => path.join(dir, name)),
    );
  };

  it('only dismisses a keyboard something raised', () => {
    const offenders: string[] = [];
    for (const file of flowFiles()) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (line.trim() !== '- hideKeyboard') return;
        // The last thing that could have raised one, within reach above.
        const before = lines
          .slice(Math.max(0, index - 6), index)
          .filter((candidate) => !candidate.trim().startsWith('#'));
        if (!before.some((candidate) => candidate.includes('inputText'))) {
          offenders.push(`${path.basename(file)}:${index + 1}`);
        }
      });
    }
    expect(offenders).toStrictEqual([]);
  });
});

/**
 * ⚠️ SCROLLING A SCREEN THAT HAS NOT MOUNTED SCROLLS NOTHING.
 *
 * `language.yaml` tapped `open-settings` and started `scrollUntilVisible`
 * immediately. On a slow simulator the Settings screen is still mounting, the
 * swipe lands on whatever is underneath, and the element is never found — it
 * failed twice on 13 September with "No visible element found: id:
 * settings-language" while the other EIGHT flows passed on the same simulator,
 * which is the signature of a race rather than a missing element.
 *
 * `assertVisible` waits. `settings.yaml` has always done this and has never
 * failed at that point.
 */
describe('a screen is waited for before it is scrolled', () => {
  const LANGUAGE = fs.readFileSync(
    path.join(__dirname, '.maestro', 'flows', 'language.yaml'),
    'utf8',
  );

  it('guards every scroll that follows an open-settings tap', () => {
    // Each `open-settings` tap must be followed by a `settings-screen`
    // assertion before the next `scrollUntilVisible`. Counting occurrences is
    // not enough — the flow already asserts that screen elsewhere, for its own
    // reasons, so a total would pass while a guard was missing.
    // ⚠️ COMMENTS STRIPPED FIRST. The guard's own comment explains the bug and
    // names `scrollUntilVisible` in prose — searching the raw text finds that
    // mention before the real command and reports a correct flow as broken.
    const code = LANGUAGE.split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');
    const segments = code.split(/- tapOn:\s*\n\s*id: 'open-settings'/u).slice(1);
    expect(segments.length).toBeGreaterThan(0);
    for (const segment of segments) {
      const guard = segment.indexOf("id: 'settings-screen'");
      const scroll = segment.indexOf('scrollUntilVisible');
      expect(guard).toBeGreaterThan(-1);
      expect(guard).toBeLessThan(scroll);
    }
  });

  // ⚠️ The order is the whole point: a guard AFTER the scroll would assert a
  // screen the scroll had already failed on.
  //
  // ⚠️ COMMENTS STRIPPED FIRST, for the same reason as the test above — and
  // this one learned it the hard way. The character budgets below measure
  // DISTANCE, so every line of comment written between the tap and the scroll
  // ate into them: explaining the flake of 14 September in the guard's own
  // note pushed the gap past 600 and turned a correct flow red. A test that
  // fails when someone documents the code is punishing the wrong thing.
  it('puts the guard between the tap and the scroll', () => {
    const code = LANGUAGE.split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');
    expect(code).toMatch(
      /id: 'open-settings'[\s\S]{0,600}?id: 'settings-screen'[\s\S]{0,200}?scrollUntilVisible/u,
    );
  });
});

/**
 * ⚠️ TWO DIFFERENT MISTAKES, both of which cost a full red Maestro run on
 * 17 September, and only one of which the first test below can catch.
 *
 * 1. A testID is DELETED or misspelled, and a flow goes on reaching for it.
 *    `permissions.yaml` did this when the 5.1.1 fix removed the dismiss
 *    button. The existence check catches that class.
 *
 * 2. A testID is RENAMED ON ONE SCREEN while the old name lives on elsewhere.
 *    #198 moved the guide's letter slide from `tap-halo` to
 *    `chip-progress-ring` — and `tap-halo` is still perfectly valid on the
 *    Translator, so the existence check passes and the flow still fails on
 *    the device. ⚠️ Nothing generic can catch this. It needs the second
 *    test, which pins WHICH flow wears WHICH hint.
 *
 * Both cost ~25 minutes in CI and six seconds here.
 */
describe('flow selectors point at testIDs that exist', () => {
  /** Every directory the app's own testIDs can be declared in. */
  const SOURCE_ROOTS = ['src'];
  const SOURCE_FILES = [path.join(__dirname, 'App.tsx')];

  const walk = (dir: string): readonly string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return /node_modules|android|ios|coverage/u.test(full) ? [] : walk(full);
      }
      return [full];
    });

  const sourceFiles = [
    ...SOURCE_ROOTS.flatMap((root) => walk(path.join(__dirname, root))),
    ...SOURCE_FILES,
  ].filter((f) => /\.tsx?$/u.test(f) && !/\.test\./u.test(f));

  const flowFiles = walk(path.join(__dirname, '.maestro')).filter((f) =>
    /\.ya?ml$/u.test(f),
  );

  /**
   * The ids the flows reach for. Maestro writes them unquoted or quoted, one
   * per `id:` key.
   */
  const selectors = new Set<string>();
  for (const file of flowFiles) {
    for (const match of fs
      .readFileSync(file, 'utf8')
      .matchAll(/^\s*id:\s*['"]?([^'"\n]+)['"]?\s*$/gmu)) {
      selectors.add(match[1].trim());
    }
  }

  /**
   * ⚠️ A testID is NOT always a bare string literal, and a check that assumed
   * so reported 41 false positives against 97 selectors — useless, and the
   * kind of guard that gets deleted rather than fixed. Four constructions are
   * real, all of them in the app today:
   *
   *   testID="translator-screen"                       a literal
   *   testID = 'chip-progress-ring'                    a default prop
   *   testID={toMorse ? 'speak-input' : 'tap-input'}   a ternary
   *   testID={`channel-${cell.channel}`}               a template
   *
   * …plus `IconButton`, whose `label` prop IS the selector — it renders
   * `testID={testID ?? label}` and says so in its own doc comment.
   *
   * Templates contribute a prefix or a suffix rather than a whole name, since
   * the middle is a runtime value.
   */
  const literals = new Set<string>();
  const prefixes = new Set<string>();
  const suffixes = new Set<string>();
  for (const file of sourceFiles) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!/\btestID\b|\blabel=/u.test(line)) continue;
      for (const m of line.matchAll(/['"]([A-Za-z0-9._-]+)['"]/gu)) literals.add(m[1]);
      for (const m of line.matchAll(/`([^`]*?)\$\{/gu)) if (m[1]) prefixes.add(m[1]);
      for (const m of line.matchAll(/\}([A-Za-z0-9._-]+)`/gu))
        if (m[1]) suffixes.add(m[1]);
    }
  }

  const resolves = (id: string): boolean =>
    literals.has(id) ||
    [...prefixes].some((p) => id.startsWith(p)) ||
    [...suffixes].some((s) => id.endsWith(s));

  it('finds a testID in the app for every id the flows reach for', () => {
    const unresolved = [...selectors].filter((id) => !resolves(id)).sort();
    // The message carries the names, because "expected 1 to be 0" on a list
    // of 97 tells whoever broke it nothing about which one.
    expect(unresolved).toEqual([]);
  });

  it('is actually looking at the flows and the app, not at nothing', () => {
    // ⚠️ Without this, deleting the .maestro directory would make the test
    // above PASS — an empty set has no unresolved members. A guard that goes
    // quiet when its input disappears is the shape of the 0.02 tolerance that
    // certified the rejected Chromebook images.
    // ⚠️ FLOORS, deliberately well below the real counts (97 selectors, 95
    // literals, 9 flows when this was written). Pinning the exact numbers was
    // tried and reverted: removing ONE selector from ONE flow — an ordinary
    // edit — failed this test as well as the real one, which trains people to
    // update the number rather than read the failure. These catch the thing
    // that actually matters, which is the scanner reading nothing at all.
    expect(selectors.size).toBeGreaterThanOrEqual(80);
    expect(literals.size).toBeGreaterThanOrEqual(80);
    expect(flowFiles.length).toBeGreaterThanOrEqual(9);
  });

  it('rejects a name that no longer exists', () => {
    // The negative control. `chip-progress-ring` is real; one letter out is
    // not, and the check has to be able to tell.
    expect(resolves('chip-progress-ring')).toBe(true);
    expect(resolves('chip-progress-rng')).toBe(false);
  });
});

describe('the guide wears the ring, the app wears the halo', () => {
  /**
   * ⚠️ COMMENTS STRIPPED FIRST, for the same reason the language guard above
   * strips them — and this test proved the point by failing on its first run.
   * `first-run.yaml` carries a comment reading '`chip-progress-ring`, NOT
   * `tap-halo`', so the raw file contains the very name the flow must not use,
   * and searching it reports a correct flow as broken.
   */
  const steps = (name: string): string =>
    fs
      .readFileSync(path.join(__dirname, '.maestro', 'flows', name), 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');

  const FIRST_RUN = steps('first-run.yaml');
  const AUDIO = steps('audio-playback.yaml');

  /**
   * ⚠️ THIS is the test that would have caught #198. Both names exist in the
   * app, so no existence check can separate them — the only thing that can is
   * saying out loud which screen wears which.
   *
   * The guide's letter slide turns twenty times to be noticed once; the
   * Translator's chips breathe four times so they are not a nag on every
   * message typed. Swapping them is a real change and should fail here first.
   */
  it('makes the guide assert the travelling ring', () => {
    expect(FIRST_RUN).toContain('chip-progress-ring');
    expect(FIRST_RUN).not.toContain('tap-halo');
  });

  it('leaves the Translator flow on the breathing halo', () => {
    expect(AUDIO).toContain('tap-halo');
    expect(AUDIO).not.toContain('chip-progress-ring');
  });
});
