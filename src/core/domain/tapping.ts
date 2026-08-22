/**
 * Tap input — turning press durations into Morse.
 *
 * Pure domain code. The dot/dash threshold lives here rather than in a screen
 * because "long" is relative to the operator's speed: a hardcoded millisecond
 * cutoff fits nobody, so the threshold is domain state that gets injected into
 * the decoder. That also makes every timing rule testable without a UI.
 */
import { decode, type MorseSymbol } from './morse';

/**
 * Everything in Morse is measured in one unit — the length of a dot. A dash is
 * three units, and the silences carry as much information as the marks do.
 */
export const UNITS = Object.freeze({
  /** A press shorter than this many units is a dot, longer is a dash. */
  dashThreshold: 1,
  /** Silence of at least this many units ends the current letter. */
  letterGap: 3,
  /** Silence of at least this many units ends the current word. */
  wordGap: 7,
});

/** Default dot length, in milliseconds. Roughly 6–7 words per minute. */
export const DEFAULT_UNIT_MS = 180;
/** Fastest cutoff the settings screen allows. */
export const MIN_UNIT_MS = 80;
/** Slowest cutoff the settings screen allows. */
export const MAX_UNIT_MS = 400;

/** One completed press, with the silence that preceded it. */
export type TapPress = Readonly<{
  /** How long the key was held, in milliseconds. */
  durationMs: number;
  /** Silence before this press. Ignored on the first press of a message. */
  gapBeforeMs: number;
}>;

/** What a silence means. */
export type GapKind = 'intra' | 'letter' | 'word';

/**
 * Holds a proposed unit length inside the range the UI offers.
 *
 * Non-finite input falls back to {@link DEFAULT_UNIT_MS} rather than
 * propagating `NaN` into every downstream comparison.
 */
export function clampUnitMs(ms: number): number {
  if (!Number.isFinite(ms)) return DEFAULT_UNIT_MS;
  return Math.min(MAX_UNIT_MS, Math.max(MIN_UNIT_MS, Math.round(ms)));
}

/**
 * Classifies one press. A press exactly on the threshold counts as a dash, so
 * that the boundary belongs to exactly one outcome.
 */
export function classifyPress(durationMs: number, unitMs: number): MorseSymbol {
  return durationMs < unitMs * UNITS.dashThreshold ? '.' : '-';
}

/** Classifies one silence into "same letter", "next letter", or "next word". */
export function classifyGap(durationMs: number, unitMs: number): GapKind {
  if (durationMs < unitMs * UNITS.letterGap) return 'intra';
  if (durationMs < unitMs * UNITS.wordGap) return 'letter';
  return 'word';
}

/**
 * Turns a sequence of presses into the canonical Morse string form.
 *
 * The gap before the very first press is ignored — there is no preceding
 * letter for it to close, and honouring it would emit a leading separator.
 */
export function tapsToMorse(presses: readonly TapPress[], unitMs: number): string {
  const unit = clampUnitMs(unitMs);
  let out = '';

  presses.forEach((press, index) => {
    if (index > 0) {
      const gap = classifyGap(press.gapBeforeMs, unit);
      if (gap === 'letter') out += ' ';
      if (gap === 'word') out += ' / ';
    }
    out += classifyPress(press.durationMs, unit);
  });

  return out;
}

/** Turns a sequence of presses straight into decoded text. */
export function decodeTaps(presses: readonly TapPress[], unitMs: number): string {
  return decode(tapsToMorse(presses, unitMs));
}
