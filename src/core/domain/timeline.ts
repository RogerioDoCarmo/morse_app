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

/**
 * The reference word every operator measures speed against. PARIS is exactly
 * 50 units including the word gap that follows it, so one unit is
 * `60000 / (50 * wpm)` milliseconds — 1200/wpm.
 */
export const PARIS_UNITS_PER_WORD = 50;

/** Milliseconds per unit at a given speed. */
export function unitMsForWpm(wordsPerMinute: number): number {
  return 60000 / (PARIS_UNITS_PER_WORD * wordsPerMinute);
}

/**
 * Default PLAYBACK speed, in words per minute.
 *
 * ⚠️ Deliberately NOT tapping's DEFAULT_UNIT_MS. That one is a dot/dash
 * threshold for a human keying by hand, and 180ms suits a learner at about
 * 6-7 wpm. Reusing it for playback made "Hello world" take twenty seconds —
 * far too slow to sit through for something the app is merely reading out.
 *
 * The Settings screen offers 5, 10 and 15 wpm, which are 240, 120 and 80ms.
 * The two speeds are separate settings and there is no reason for them to
 * agree: you can key slowly and still want to listen quickly.
 */
export const DEFAULT_PLAYBACK_WPM = 10;

/** The same default expressed as a unit length. */
export const DEFAULT_PLAYBACK_UNIT_MS = unitMsForWpm(DEFAULT_PLAYBACK_WPM);

/**
 * Holds a playback speed inside the range the settings screen offers.
 *
 * Shares tapping's range — one slider's worth of sensible unit lengths covers
 * both — but falls back to the PLAYBACK default rather than the tap threshold
 * when handed something that is not a number.
 */
export function clampPlaybackUnitMs(ms: number): number {
  return Number.isFinite(ms) ? clampUnitMs(ms) : DEFAULT_PLAYBACK_UNIT_MS;
}

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

/** A moment the output flips on or off. */
export type SignalChange = Readonly<{ atUnit: number; on: boolean }>;

/**
 * The message as a list of moments the output changes state.
 *
 * This is what an on/off output consumes — a torch, a flickering screen, a
 * motor. Segments say how long each stretch lasts; changes say when to act,
 * which is what a scheduler actually needs. A trailing `off` closes the last
 * mark, so nothing is left switched on at the end.
 */
export function signalChanges(timeline: MorseTimeline): readonly SignalChange[] {
  if (timeline.segments.length === 0) return [];

  const changes: SignalChange[] = [];
  let atUnit = 0;
  timeline.segments.forEach((segment) => {
    changes.push({ atUnit, on: segment.on });
    atUnit += segment.units;
  });
  changes.push({ atUnit, on: false });

  return changes;
}

/**
 * Whether the output should be on at `atUnit`.
 *
 * A driver polls this rather than firing a chain of timers: a poll that is
 * late still lands on the right state, whereas a backlog of timers fires a
 * burst of stale ones. Off before the message starts and after it ends.
 */
export function signalAt(changes: readonly SignalChange[], atUnit: number): boolean {
  let on = false;
  changes.forEach((change) => {
    if (atUnit >= change.atUnit) on = change.on;
  });
  return on;
}

/**
 * The part of a message still to come at `fromUnit`.
 *
 * Lets an output join a run already in progress: render this and it starts
 * exactly where the others are, rather than from the beginning. A mark that
 * is mid-way through when the tail begins is truncated, not restarted — the
 * listener hears the rest of it, which is what the other channels are doing.
 */
export function timelineFrom(timeline: MorseTimeline, fromUnit: number): MorseTimeline {
  const segments: TimelineSegment[] = [];
  let start = 0;

  timeline.segments.forEach((segment) => {
    const end = start + segment.units;
    if (end > fromUnit) {
      // Whole segment when it starts after the cut, the remainder when the cut
      // falls inside it — `Math.max` says both without a branch to get wrong.
      segments.push({ on: segment.on, units: end - Math.max(start, fromUnit) });
    }
    start = end;
  });

  return {
    segments,
    totalUnits: segments.reduce((sum, segment) => sum + segment.units, 0),
  };
}

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

/** Where one letter sits on the timeline. */
export type LetterSpan = Readonly<{
  /**
   * Flat index across the whole message, counting every letter in every word —
   * the same numbering the Morse output uses to identify a letter, so an index
   * from here can be handed straight to it.
   */
  index: number;
  /** Unit the letter's first mark begins on. */
  startUnit: number;
  /** Unit its last mark ends on. */
  endUnit: number;
}>;

/**
 * Locates every letter on the timeline, so a caller can light one in time with
 * the sound.
 *
 * Times the message exactly as {@link toTimeline} does — a letter with no marks
 * earns neither a gap nor a span — but keeps counting the flat index through
 * the skipped ones so it still matches the rendered output.
 */
export function letterSpans(message: MorseMessage): readonly LetterSpan[] {
  const spans: LetterSpan[] = [];
  let unit = 0;
  let index = 0;
  let sounded = false;

  message.words.forEach((word) => {
    const audible = word.letters.filter((letter) => letter.symbols.length > 0);
    if (audible.length === 0) {
      index += word.letters.length;
      return;
    }

    if (sounded) unit += PLAYBACK_UNITS.wordGap;
    let firstOfWord = true;

    word.letters.forEach((letter) => {
      const here = index;
      index += 1;
      if (letter.symbols.length === 0) return;

      if (!firstOfWord) unit += PLAYBACK_UNITS.letterGap;
      firstOfWord = false;
      sounded = true;

      const startUnit = unit;
      letter.symbols.forEach((symbol, symbolIndex) => {
        if (symbolIndex > 0) unit += PLAYBACK_UNITS.symbolGap;
        unit += symbol === '.' ? PLAYBACK_UNITS.dot : PLAYBACK_UNITS.dash;
      });
      spans.push({ index: here, startUnit: startUnit, endUnit: unit });
    });
  });

  return spans;
}

/**
 * Which letter the playhead is on at `elapsedUnits`.
 *
 * A letter stays current through the silence that follows it, until the next
 * one begins. Clearing it during every gap would make the highlight strobe —
 * there is a gap after every letter, and the gaps are up to seven times longer
 * than a dot.
 */
export function soundingIndexAt(
  spans: readonly LetterSpan[],
  elapsedUnits: number,
): number | null {
  let current: number | null = null;
  spans.forEach((span) => {
    if (elapsedUnits >= span.startUnit) current = span.index;
  });
  return current;
}

/**
 * Converts a timeline to real durations.
 *
 * `unitMs` goes through {@link clampPlaybackUnitMs}, so a nonsensical value
 * cannot turn every duration into `NaN`.
 */
export function toTimedSegments(
  timeline: MorseTimeline,
  unitMs: number,
): readonly TimedSegment[] {
  const clamped = clampPlaybackUnitMs(unitMs);
  return timeline.segments.map((segment) => ({
    on: segment.on,
    ms: segment.units * clamped,
  }));
}

/** How long the whole message takes to play, in milliseconds. */
export function totalMs(timeline: MorseTimeline, unitMs: number): number {
  return timeline.totalUnits * clampPlaybackUnitMs(unitMs);
}
