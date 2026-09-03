/**
 * Playback timing — turning an encoded message into a timed on/off sequence.
 *
 * Pure domain code: no React, no Expo, no I/O, no timers. This module decides
 * WHAT happens and for how long; actually waiting is an adapter's job.
 *
 * Every output this app offers plays the same sequence — an audio tone, the
 * camera torch, an on-screen flicker, and vibration. They differ only in what
 * "on" drives, so the timing is modelled once here and each adapter consumes
 * it. Getting a second copy of these rules into a torch or audio adapter is
 * exactly the drift this module exists to prevent.
 */
import { clampUnitMs } from './tapping';
import type { MorseMessage } from './morse';

/**
 * Playback durations in units, per ITU-R M.1677-1.
 *
 * ⚠️ Deliberately NOT shared with `UNITS` in ./tapping, even though three of
 * the numbers match today. Those are input tolerances — how sloppy a human's
 * keying may be before it is classified as the next thing up — and they are
 * free to loosen. These are exact output durations, and loosening them would
 * make the app transmit incorrect Morse. Same numbers, opposite obligations.
 */
export const PLAYBACK_UNITS = Object.freeze({
  /** A dot is one unit of signal. */
  dot: 1,
  /** A dash is three. */
  dash: 3,
  /** Silence between two marks of the same letter. */
  symbolGap: 1,
  /** Silence between two letters of the same word. */
  letterGap: 3,
  /** Silence between two words. */
  wordGap: 7,
});

/** One stretch of the output being on or off. Never zero-length. */
export type TimelineSegment = Readonly<{
  /** True while the tone, torch, screen or motor is driven. */
  on: boolean;
  /** How long this stretch lasts, in Morse units. */
  units: number;
}>;

/** A whole message as an alternating on/off sequence. */
export type MorseTimeline = Readonly<{
  /**
   * Strictly alternating, starting and ending with an `on` segment. There is
   * no leading or trailing silence: where playback sits inside a longer
   * sequence is the caller's business, not the message's.
   */
  segments: readonly TimelineSegment[];
  /** The sum of every segment, so callers need not re-add them. */
  totalUnits: number;
}>;

/** One stretch of playback in real time. */
export type TimedSegment = Readonly<{ on: boolean; ms: number }>;

/**
 * Lays a message out as an alternating on/off sequence.
 *
 * Words with no letters and letters with no marks are skipped rather than
 * emitting the gap that would precede them, so a malformed message cannot
 * produce leading, trailing or doubled silence. {@link encode} never builds
 * one, but a hand-constructed message might.
 */
export function toTimeline(message: MorseMessage): MorseTimeline {
  const segments: TimelineSegment[] = [];
  const push = (on: boolean, units: number): void => {
    segments.push({ on, units });
  };

  const words = message.words.filter((word) =>
    word.letters.some((letter) => letter.symbols.length > 0),
  );

  words.forEach((word, wordIndex) => {
    if (wordIndex > 0) push(false, PLAYBACK_UNITS.wordGap);

    const letters = word.letters.filter((letter) => letter.symbols.length > 0);

    letters.forEach((letter, letterIndex) => {
      if (letterIndex > 0) push(false, PLAYBACK_UNITS.letterGap);

      letter.symbols.forEach((symbol, symbolIndex) => {
        if (symbolIndex > 0) push(false, PLAYBACK_UNITS.symbolGap);
        push(true, symbol === '.' ? PLAYBACK_UNITS.dot : PLAYBACK_UNITS.dash);
      });
    });
  });

  return {
    segments,
    totalUnits: segments.reduce((sum, segment) => sum + segment.units, 0),
  };
}

/**
 * Converts a timeline to real durations.
 *
 * `unitMs` goes through {@link clampUnitMs}, so the one speed the user can
 * configure governs playback as well as tap input, and a nonsensical value
 * cannot turn every duration into `NaN`.
 */
export function toTimedSegments(
  timeline: MorseTimeline,
  unitMs: number,
): readonly TimedSegment[] {
  const clamped = clampUnitMs(unitMs);
  return timeline.segments.map((segment) => ({
    on: segment.on,
    ms: segment.units * clamped,
  }));
}

/** How long the whole message takes to play, in milliseconds. */
export function totalMs(timeline: MorseTimeline, unitMs: number): number {
  return timeline.totalUnits * clampUnitMs(unitMs);
}
