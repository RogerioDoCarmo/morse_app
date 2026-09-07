// Maestro flows are YAML that nothing type-checks and that only CI ever runs,
// twenty minutes at a time. These tests hold the two things about
// audio-playback.yaml that broke it, so a mistake in either costs six seconds
// here instead of a red run on develop.
import * as fs from 'fs';
import * as path from 'path';

import { encode } from '@/core/domain/morse';
import { DEFAULT_SETTINGS } from '@/core/domain/settings';
import { toTimeline, unitMsForWpm } from '@/core/domain/timeline';

const FLOW = path.join(__dirname, '.maestro', 'flows', 'audio-playback.yaml');
const flow = fs.readFileSync(FLOW, 'utf8');

/**
 * The wall-clock cost of the flow's longest section on the CI simulator,
 * measured from the recording of the run that failed: a tap that starts the
 * run (12.1s), an assertion (0.3s), a tap on a letter mid-message (21.7s) and
 * a second assertion. The message has to outlive all of it.
 */
const LONGEST_SECTION_MS = 34_000;

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
  // Every section starts a run, does something to it, and stops it. If the
  // message ends first the section's own assertions start failing, which is
  // what "Assertion is false: id: playback-progress is visible" meant — the
  // run had finished two seconds before the assertion opened.
  it('types a message that outlasts the longest section twice over', () => {
    const typed = /inputText:\s*'([^']+)'/.exec(flow)?.[1];
    expect(typed).toBeDefined();

    const units = toTimeline(encode(typed as string)).totalUnits;
    const playbackMs = units * unitMsForWpm(DEFAULT_SETTINGS.playbackWpm);

    expect(playbackMs).toBeGreaterThan(LONGEST_SECTION_MS * 2);
  });

  // The flow reads the DEFAULT speed, so it has to start from cleared state —
  // otherwise a leftover 15 wpm from another flow would make the message a
  // third shorter than the test above just proved it to be.
  it('launches from cleared state, so the default speed is the one it gets', () => {
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
  // make every assertion in this file vacuously true.
  it('finds the taps it is reasoning about', () => {
    const found = taps(flow);

    expect(found.filter((tap) => tap.id === 'signal-button')).toHaveLength(10);
    expect(found.filter((tap) => tap.skipsSettle)).toHaveLength(7);
  });
});
