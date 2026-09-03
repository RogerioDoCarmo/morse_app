import { encode } from './morse';
import { DEFAULT_UNIT_MS, MAX_UNIT_MS, MIN_UNIT_MS } from './tapping';
import {
  DEFAULT_PLAYBACK_UNIT_MS,
  DEFAULT_PLAYBACK_WPM,
  PARIS_UNITS_PER_WORD,
  PLAYBACK_UNITS,
  clampPlaybackUnitMs,
  letterSpans,
  soundingIndexAt,
  toTimeline,
  toTimedSegments,
  totalMs,
  unitMsForWpm,
} from './timeline';

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

  it('falls back to the playback default rather than producing NaN durations', () => {
    expect(toTimedSegments(toTimeline(encode('E')), Number.NaN)).toEqual([
      { on: true, ms: DEFAULT_PLAYBACK_UNIT_MS },
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

describe('playback speed', () => {
  // PARIS is 50 units, so a unit is 1200/wpm milliseconds. These three are the
  // speeds the Settings screen offers.
  it('converts words per minute to a unit length', () => {
    expect(PARIS_UNITS_PER_WORD).toBe(50);
    expect(unitMsForWpm(5)).toBe(240);
    expect(unitMsForWpm(10)).toBe(120);
    expect(unitMsForWpm(15)).toBe(80);
  });

  it('defaults to 10 words per minute', () => {
    expect(DEFAULT_PLAYBACK_WPM).toBe(10);
    expect(DEFAULT_PLAYBACK_UNIT_MS).toBe(120);
  });

  // The whole point of a separate setting. Reusing the tap threshold made
  // "Hello world" take twenty seconds.
  it('plays faster than a human keys', () => {
    expect(DEFAULT_PLAYBACK_UNIT_MS).toBeLessThan(DEFAULT_UNIT_MS);
  });

  it('offers every Settings speed inside the allowed range', () => {
    [5, 10, 15].forEach((wpm) => {
      const ms = unitMsForWpm(wpm);
      expect(clampPlaybackUnitMs(ms)).toBe(ms);
    });
  });

  it('holds an out-of-range speed and falls back on nonsense', () => {
    expect(clampPlaybackUnitMs(1)).toBe(MIN_UNIT_MS);
    expect(clampPlaybackUnitMs(9000)).toBe(MAX_UNIT_MS);
    expect(clampPlaybackUnitMs(Number.NaN)).toBe(DEFAULT_PLAYBACK_UNIT_MS);
    expect(clampPlaybackUnitMs(Number.POSITIVE_INFINITY)).toBe(DEFAULT_PLAYBACK_UNIT_MS);
  });

  it('plays Hello world in 13.3 seconds rather than 20', () => {
    const timeline = toTimeline(encode('Hello world'));

    expect(timeline.totalUnits).toBe(111);
    expect(totalMs(timeline, DEFAULT_PLAYBACK_UNIT_MS)).toBe(13320);
    expect(totalMs(timeline, DEFAULT_UNIT_MS)).toBe(19980);
  });
});

describe('letterSpans', () => {
  it('finds nothing in a message with nothing to play', () => {
    expect(letterSpans(encode(''))).toEqual([]);
  });

  it('starts the first letter at zero', () => {
    expect(letterSpans(encode('E'))).toEqual([{ index: 0, startUnit: 0, endUnit: 1 }]);
  });

  it('spans a letter from its first mark to its last', () => {
    // A is dot(1) gap(1) dash(3).
    expect(letterSpans(encode('A'))).toEqual([{ index: 0, startUnit: 0, endUnit: 5 }]);
  });

  it('leaves the letter gap between spans', () => {
    expect(letterSpans(encode('EE'))).toEqual([
      { index: 0, startUnit: 0, endUnit: 1 },
      { index: 1, startUnit: 4, endUnit: 5 },
    ]);
  });

  it('leaves the longer word gap between words', () => {
    expect(letterSpans(encode('E E'))).toEqual([
      { index: 0, startUnit: 0, endUnit: 1 },
      { index: 1, startUnit: 8, endUnit: 9 },
    ]);
  });

  it('numbers letters straight through, so an index identifies one letter', () => {
    expect(letterSpans(encode('AB CD')).map((span) => span.index)).toEqual([0, 1, 2, 3]);
  });

  // The output numbers every letter it renders; the timeline skips silent ones.
  // If those two disagree, playback lights the wrong chip.
  it('keeps counting the index through letters it does not sound', () => {
    expect(
      letterSpans({
        words: [
          {
            letters: [
              { char: 'E', symbols: ['.'] },
              { char: '', symbols: [] },
              { char: 'T', symbols: ['-'] },
            ],
          },
        ],
      }),
    ).toEqual([
      { index: 0, startUnit: 0, endUnit: 1 },
      { index: 2, startUnit: 4, endUnit: 7 },
    ]);
  });

  // A word with nothing audible in it must earn no word gap — otherwise every
  // letter after it plays late — while still advancing the flat index, or the
  // letters after it light one chip too early.
  it('skips a silent word without paying for it in time or in index', () => {
    expect(
      letterSpans({
        words: [
          { letters: [{ char: 'E', symbols: ['.'] }] },
          {
            letters: [
              { char: '', symbols: [] },
              { char: '', symbols: [] },
            ],
          },
          { letters: [{ char: 'T', symbols: ['-'] }] },
        ],
      }),
    ).toEqual([
      { index: 0, startUnit: 0, endUnit: 1 },
      // One word gap, not two, and the index has passed over both silent letters.
      { index: 3, startUnit: 8, endUnit: 11 },
    ]);
  });

  it('ends exactly where the timeline ends', () => {
    const spans = letterSpans(encode('SOS'));
    expect(spans[spans.length - 1]?.endUnit).toBe(toTimeline(encode('SOS')).totalUnits);
  });
});

describe('soundingIndexAt', () => {
  const spans = letterSpans(encode('EE'));

  it('is nothing before the first letter begins', () => {
    expect(soundingIndexAt(spans, -1)).toBeNull();
  });

  it('lands on the first letter as it starts', () => {
    expect(soundingIndexAt(spans, 0)).toBe(0);
  });

  // There is a gap after every letter, and gaps run up to seven units. Clearing
  // the highlight in them would strobe.
  it('holds a letter through the silence that follows it', () => {
    expect(soundingIndexAt(spans, 1)).toBe(0);
    expect(soundingIndexAt(spans, 3.9)).toBe(0);
  });

  it('moves on when the next letter begins', () => {
    expect(soundingIndexAt(spans, 4)).toBe(1);
  });

  it('stays on the last letter once the message is over', () => {
    expect(soundingIndexAt(spans, 99)).toBe(1);
  });

  it('is nothing at all when there is nothing to play', () => {
    expect(soundingIndexAt([], 5)).toBeNull();
  });
});
