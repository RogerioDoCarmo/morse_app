/**
 * Calibrating the dot/dash cut-off from the operator's own hand.
 *
 * The cut-off is a number of milliseconds, and nobody can feel a millisecond:
 * a slider from 80 to 400 asks a learner to guess a value they have no way to
 * measure. Calibration measures it instead. They key a few dots and a few
 * dashes, in that order, and the cut-off lands between the two.
 *
 * The order is what makes this work. A press cannot be classified before there
 * is a cut-off to classify it against, so the screen asks for the dots first
 * and the dashes second and the position of each press says which it was.
 */
import { clampUnitMs } from './tapping';

/** How many of each mark calibration asks for, dots first. */
export const CALIBRATION_MARKS = Object.freeze({ dots: 3, dashes: 3 });

/**
 * How much longer a dash must be than a dot for the two to be told apart.
 *
 * ITU timing makes a dash three times a dot. Half of that is a generous floor:
 * below it the hand is not making two different marks, and any cut-off drawn
 * between them would misread the next press either way.
 */
export const MIN_DASH_TO_DOT_RATIO = 1.5;

/** The settings slider's step, so a calibrated value is one it can show. */
const STEP_MS = 10;

/** The middle value, or the mean of the middle two. */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  // A slice rather than two indexed reads, which would each be `number |
  // undefined` and need a guard that can never fire.
  const centre =
    sorted.length % 2 === 0
      ? sorted.slice(middle - 1, middle + 1)
      : sorted.slice(middle, middle + 1);
  return centre.reduce((sum, value) => sum + value, 0) / centre.length;
}

/**
 * The cut-off that separates these dots from these dashes, or `null` when it
 * cannot be told.
 *
 * Medians rather than means, so one fumbled press does not drag the result.
 * The cut-off is their GEOMETRIC mean: a dash is a multiple of a dot, so the
 * point equally far from both is a ratio, not a difference. It also sits
 * nearer the dots than the arithmetic midpoint, which matters because the same
 * value times the silences — a cut-off pushed high would start merging
 * letters.
 *
 * `null` when either list is empty, a duration is not a positive number, or
 * the dashes are not clearly longer than the dots.
 */
export function calibrateUnitMs(
  dots: readonly number[],
  dashes: readonly number[],
): number | null {
  // An empty list has a median of NaN (0 / 0), so the two checks below turn
  // it away too: no separate guard for nothing to measure.
  const dot = median(dots);
  const dash = median(dashes);
  if (!(dot > 0) || !Number.isFinite(dash)) return null;
  if (dash < dot * MIN_DASH_TO_DOT_RATIO) return null;
  return clampUnitMs(Math.round(Math.sqrt(dot * dash) / STEP_MS) * STEP_MS);
}
