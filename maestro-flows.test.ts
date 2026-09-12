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
