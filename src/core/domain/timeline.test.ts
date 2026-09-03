import { encode } from './morse';
import { DEFAULT_UNIT_MS, MAX_UNIT_MS, MIN_UNIT_MS } from './tapping';
import { PLAYBACK_UNITS, toTimeline, toTimedSegments, totalMs } from './timeline';

/** Compact rendering of a timeline, so expectations read like the signal does. */
const shape = (text: string): string =>
  toTimeline(encode(text))
    .segments.map((segment) => `${segment.on ? '+' : '-'}${segment.units}`)
    .join(' ');

describe('toTimeline', () => {
  it('plays nothing for text that encodes to nothing', () => {
    expect(toTimeline(encode(''))).toEqual({ segments: [], totalUnits: 0 });
    expect(toTimeline(encode('   '))).toEqual({ segments: [], totalUnits: 0 });
    // Every character here is unsupported, so it normalises away entirely.
    expect(toTimeline(encode('日本語'))).toEqual({ segments: [], totalUnits: 0 });
  });

  it('plays a single dot as one unit of signal and nothing else', () => {
    expect(shape('E')).toBe('+1');
    expect(toTimeline(encode('E')).totalUnits).toBe(1);
  });

  it('plays a single dash as three units', () => {
    expect(shape('T')).toBe('+3');
    expect(toTimeline(encode('T')).totalUnits).toBe(3);
  });

  it('separates marks within a letter by one unit', () => {
    // A is dot-dash.
    expect(shape('A')).toBe('+1 -1 +3');
    expect(toTimeline(encode('A')).totalUnits).toBe(5);
  });

  it('separates letters by three units', () => {
    expect(shape('EE')).toBe('+1 -3 +1');
    expect(toTimeline(encode('EE')).totalUnits).toBe(5);
  });

  it('separates words by seven units', () => {
    expect(shape('E E')).toBe('+1 -7 +1');
    expect(toTimeline(encode('E E')).totalUnits).toBe(9);
  });

  it('lays out a whole message', () => {
    // SOS: ... --- ...
    expect(shape('SOS')).toBe('+1 -1 +1 -1 +1 -3 +3 -1 +3 -1 +3 -3 +1 -1 +1 -1 +1');
    // 3 dots + 2 gaps, 3 dashes + 2 gaps, again, and two letter gaps.
    expect(toTimeline(encode('SOS')).totalUnits).toBe(27);
  });

  it('never begins or ends with silence', () => {
    const { segments } = toTimeline(encode('HI THERE'));
    expect(segments[0]?.on).toBe(true);
    expect(segments[segments.length - 1]?.on).toBe(true);
  });

  // encode() cannot build these, but a hand-assembled message can, and a stray
  // gap would desynchronise every output that consumes the timeline.
  it('skips empty words and letters rather than emitting their gaps', () => {
    expect(
      toTimeline({
        words: [
          // No letters at all.
          { letters: [] },
          // Letters, but not one mark between them — still nothing to play, so
          // it must not earn itself a word gap.
          { letters: [{ char: '', symbols: [] }] },
          // A real letter alongside an empty one.
          {
            letters: [
              { char: 'E', symbols: ['.'] },
              { char: '', symbols: [] },
            ],
          },
          { letters: [] },
        ],
      }),
    ).toEqual({ segments: [{ on: true, units: 1 }], totalUnits: 1 });
  });
});

describe('PLAYBACK_UNITS', () => {
  // Pinned to ITU-R M.1677-1. These are not tuning knobs: changing one makes
  // the app transmit Morse that other operators will read incorrectly.
  it('matches the international standard', () => {
    expect(PLAYBACK_UNITS).toEqual({
      dot: 1,
      dash: 3,
      symbolGap: 1,
      letterGap: 3,
      wordGap: 7,
    });
  });
});

describe('toTimedSegments', () => {
  it('scales every segment by the unit length', () => {
    expect(toTimedSegments(toTimeline(encode('A')), 100)).toEqual([
      { on: true, ms: 100 },
      { on: false, ms: 100 },
      { on: true, ms: 300 },
    ]);
  });

  it('holds an out-of-range speed inside the range the UI offers', () => {
    expect(toTimedSegments(toTimeline(encode('E')), 5)).toEqual([
      { on: true, ms: MIN_UNIT_MS },
    ]);
    expect(toTimedSegments(toTimeline(encode('E')), 9000)).toEqual([
      { on: true, ms: MAX_UNIT_MS },
    ]);
  });

  it('falls back to the default rather than producing NaN durations', () => {
    expect(toTimedSegments(toTimeline(encode('E')), Number.NaN)).toEqual([
      { on: true, ms: DEFAULT_UNIT_MS },
    ]);
  });

  it('plays nothing for an empty timeline', () => {
    expect(toTimedSegments(toTimeline(encode('')), 100)).toEqual([]);
  });
});

describe('totalMs', () => {
  it('is the whole message at the given speed', () => {
    // SOS is 27 units.
    expect(totalMs(toTimeline(encode('SOS')), 100)).toBe(2700);
  });

  it('is zero for an empty timeline', () => {
    expect(totalMs(toTimeline(encode('')), 100)).toBe(0);
  });
});
