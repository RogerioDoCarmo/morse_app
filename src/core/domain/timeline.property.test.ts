import fc from 'fast-check';
import { SUPPORTED_CHARACTERS, encode } from './morse';
import { MAX_UNIT_MS, MIN_UNIT_MS } from './tapping';
import { PLAYBACK_UNITS, toTimeline, toTimedSegments, totalMs } from './timeline';

/** Arbitrary text drawn only from characters the app can represent. */
const supportedText = fc
  .array(fc.constantFrom(...SUPPORTED_CHARACTERS, ' '), { minLength: 0, maxLength: 40 })
  .map((chars) => chars.join(''));

/** Every mark in a message, flattened. */
const symbolsOf = (text: string): string[] =>
  encode(text).words.flatMap((word) => word.letters.flatMap((letter) => letter.symbols));

describe('timeline properties', () => {
  it('strictly alternates between signal and silence', () => {
    fc.assert(
      fc.property(supportedText, (text) => {
        const flags = toTimeline(encode(text)).segments.map((segment) => segment.on);

        // Each flag is the negation of the one before it.
        expect(flags.slice(1)).toEqual(flags.slice(0, -1).map((on) => !on));
      }),
    );
  });

  it('starts and ends with signal, never silence', () => {
    fc.assert(
      fc.property(supportedText, (text) => {
        const { segments } = toTimeline(encode(text));
        fc.pre(segments.length > 0);
        expect(segments[0]?.on).toBe(true);
        expect(segments[segments.length - 1]?.on).toBe(true);
      }),
    );
  });

  it('emits exactly one signal segment per mark', () => {
    fc.assert(
      fc.property(supportedText, (text) => {
        const { segments } = toTimeline(encode(text));
        expect(segments.filter((segment) => segment.on)).toHaveLength(
          symbolsOf(text).length,
        );
      }),
    );
  });

  it('gives every signal segment a dot or a dash length', () => {
    fc.assert(
      fc.property(supportedText, (text) => {
        toTimeline(encode(text))
          .segments.filter((segment) => segment.on)
          .forEach((segment) => {
            expect([PLAYBACK_UNITS.dot, PLAYBACK_UNITS.dash]).toContain(segment.units);
          });
      }),
    );
  });

  it('gives every silence one of the three standard gap lengths', () => {
    fc.assert(
      fc.property(supportedText, (text) => {
        toTimeline(encode(text))
          .segments.filter((segment) => !segment.on)
          .forEach((segment) => {
            expect([
              PLAYBACK_UNITS.symbolGap,
              PLAYBACK_UNITS.letterGap,
              PLAYBACK_UNITS.wordGap,
            ]).toContain(segment.units);
          });
      }),
    );
  });

  it('reports a total equal to the sum of its segments', () => {
    fc.assert(
      fc.property(supportedText, (text) => {
        const timeline = toTimeline(encode(text));
        expect(timeline.totalUnits).toBe(
          timeline.segments.reduce((sum, segment) => sum + segment.units, 0),
        );
      }),
    );
  });

  it('keeps every duration positive, so nothing plays for no time', () => {
    fc.assert(
      fc.property(supportedText, fc.integer({ min: 1, max: 1000 }), (text, unitMs) => {
        toTimedSegments(toTimeline(encode(text)), unitMs).forEach((segment) => {
          expect(segment.ms).toBeGreaterThan(0);
        });
      }),
    );
  });

  it('times out to the same shape it laid out, at any speed', () => {
    fc.assert(
      fc.property(supportedText, fc.double({ noNaN: true }), (text, unitMs) => {
        const timeline = toTimeline(encode(text));
        const timed = toTimedSegments(timeline, unitMs);

        expect(timed.map((segment) => segment.on)).toEqual(
          timeline.segments.map((segment) => segment.on),
        );
        expect(timed.reduce((sum, segment) => sum + segment.ms, 0)).toBe(
          totalMs(timeline, unitMs),
        );
      }),
    );
  });

  it('never plays faster or slower than the settings range allows', () => {
    fc.assert(
      fc.property(supportedText, fc.double({ noNaN: true }), (text, unitMs) => {
        const timeline = toTimeline(encode(text));
        fc.pre(timeline.totalUnits > 0);
        const ms = totalMs(timeline, unitMs);

        expect(ms).toBeGreaterThanOrEqual(timeline.totalUnits * MIN_UNIT_MS);
        expect(ms).toBeLessThanOrEqual(timeline.totalUnits * MAX_UNIT_MS);
      }),
    );
  });
});
