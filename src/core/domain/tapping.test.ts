import {
  DEFAULT_UNIT_MS,
  MAX_UNIT_MS,
  MIN_UNIT_MS,
  classifyGap,
  classifyPress,
  clampUnitMs,
  decodeTaps,
  tapsToMorse,
  type TapPress,
} from './tapping';

describe('clampUnitMs', () => {
  it('holds the value inside the range the settings screen offers', () => {
    expect(clampUnitMs(10)).toBe(MIN_UNIT_MS);
    expect(clampUnitMs(9999)).toBe(MAX_UNIT_MS);
    expect(clampUnitMs(200)).toBe(200);
  });

  it('rounds fractional milliseconds', () => {
    expect(clampUnitMs(180.6)).toBe(181);
  });

  it('falls back to the default rather than propagating NaN', () => {
    expect(clampUnitMs(Number.NaN)).toBe(DEFAULT_UNIT_MS);
    expect(clampUnitMs(Number.POSITIVE_INFINITY)).toBe(DEFAULT_UNIT_MS);
  });
});

describe('classifyPress', () => {
  it('reads a short press as a dot', () => {
    expect(classifyPress(90, 180)).toBe('.');
  });

  it('reads a long press as a dash', () => {
    expect(classifyPress(400, 180)).toBe('-');
  });

  it('gives the boundary to the dash, so it belongs to exactly one outcome', () => {
    expect(classifyPress(179, 180)).toBe('.');
    expect(classifyPress(180, 180)).toBe('-');
  });
});

describe('classifyGap', () => {
  it('keeps short silences inside the letter', () => {
    expect(classifyGap(180, 180)).toBe('intra');
    expect(classifyGap(539, 180)).toBe('intra');
  });

  it('closes the letter at three units', () => {
    expect(classifyGap(540, 180)).toBe('letter');
    expect(classifyGap(1259, 180)).toBe('letter');
  });

  it('closes the word at seven units', () => {
    expect(classifyGap(1260, 180)).toBe('word');
    expect(classifyGap(5000, 180)).toBe('word');
  });
});

describe('tapsToMorse', () => {
  const press = (durationMs: number, gapBeforeMs: number): TapPress => ({
    durationMs,
    gapBeforeMs,
  });

  it('ignores the silence before the very first press', () => {
    expect(tapsToMorse([press(50, 99999)], 180)).toBe('.');
  });

  it('spells a letter from its marks', () => {
    const taps = [press(50, 0), press(50, 180), press(50, 180), press(50, 180)];
    expect(tapsToMorse(taps, 180)).toBe('....');
  });

  it('separates letters and words by silence alone', () => {
    const taps = [press(50, 0), press(50, 540), press(50, 1300)];
    expect(tapsToMorse(taps, 180)).toBe('. . / .');
  });

  it('produces nothing for no presses', () => {
    expect(tapsToMorse([], 180)).toBe('');
    expect(decodeTaps([], 180)).toBe('');
  });
});

describe('decodeTaps', () => {
  it('decodes SOS tapped at 180 ms', () => {
    const dot = (gap: number): TapPress => ({ durationMs: 90, gapBeforeMs: gap });
    const dash = (gap: number): TapPress => ({ durationMs: 360, gapBeforeMs: gap });
    const taps = [
      dot(0),
      dot(180),
      dot(180),
      dash(540),
      dash(180),
      dash(180),
      dot(540),
      dot(180),
      dot(180),
    ];
    expect(decodeTaps(taps, 180)).toBe('SOS');
  });

  it('reads the same presses differently when the operator changes the cut-off', () => {
    const taps = [{ durationMs: 200, gapBeforeMs: 0 }];
    expect(decodeTaps(taps, 180)).toBe('T');
    expect(decodeTaps(taps, 300)).toBe('E');
  });
});
