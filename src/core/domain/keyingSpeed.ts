/**
 * How fast a message was keyed — the readout on the Tap screen.
 *
 * The decoder already measures every press to tell a dot from a dash, and
 * until this existed it never reported back: a learner had no way to tell a
 * steady fist from a drifting one.
 *
 * ⚠️ CHARACTER speed, not overall speed. Only the marks and the silences
 * inside each letter are counted. The gaps between letters and words are
 * where a learner stops to think, and counting them would report the pause
 * rather than the hand. It is the Farnsworth split the Learn tab teaches:
 * letters at speed, spacing as wide as it needs to be.
 *
 * Its own module because it needs both ./tapping (to classify) and ./timeline
 * (for PARIS), and ./timeline already imports ./tapping.
 */
import { PARIS_UNITS_PER_WORD, PLAYBACK_UNITS } from './timeline';
import { classifyGap, classifyPress, clampUnitMs, type TapPress } from './tapping';

/**
 * Words per minute over the presses keyed so far, or `null` with nothing to
 * measure.
 *
 * Each mark is judged against the same cut-off the decoder uses, then counted
 * at its exact ITU length — one unit for a dot, three for a dash, one for the
 * silence between marks — so the result says how long a unit of THIS hand is.
 * Rounded to a whole word, and never below one: a learner holding the key for
 * ten seconds is slow, not stopped.
 */
export function keyedWpm(presses: readonly TapPress[], unitMs: number): number | null {
  const unit = clampUnitMs(unitMs);
  let units = 0;
  let elapsedMs = 0;

  presses.forEach((press, index) => {
    if (index > 0 && classifyGap(press.gapBeforeMs, unit) === 'intra') {
      units += PLAYBACK_UNITS.symbolGap;
      elapsedMs += press.gapBeforeMs;
    }
    units +=
      classifyPress(press.durationMs, unit) === '.'
        ? PLAYBACK_UNITS.dot
        : PLAYBACK_UNITS.dash;
    elapsedMs += press.durationMs;
  });

  if (elapsedMs <= 0) return null;
  const measuredUnitMs = elapsedMs / units;
  return Math.max(1, Math.round(60000 / (PARIS_UNITS_PER_WORD * measuredUnitMs)));
}
