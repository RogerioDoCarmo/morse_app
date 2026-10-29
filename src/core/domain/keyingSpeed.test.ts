import { keyedWpm } from './keyingSpeed';
import type { TapPress } from './tapping';

const press = (durationMs: number, gapBeforeMs = 0): TapPress => ({
  durationMs,
  gapBeforeMs,
});

describe('keyedWpm', () => {
  it('has nothing to report before anything is keyed', () => {
    expect(keyedWpm([], 180)).toBeNull();
  });

  // PARIS: one unit is 1200/wpm ms, so a 120ms dot is 10 wpm.
  it('reads a single dot as one unit', () => {
    expect(keyedWpm([press(120)], 180)).toBe(10);
  });

  it('reads a dash as three units', () => {
    expect(keyedWpm([press(300)], 180)).toBe(12);
  });

  // A: dot, one unit of silence, dash — five units in 500ms.
  it('counts the silence inside a letter as one unit', () => {
    expect(keyedWpm([press(100), press(300, 100)], 180)).toBe(12);
  });

  // The gaps between letters and words are thinking time for a learner, and
  // counting them would report the pause rather than the fist.
  it('leaves out the silence between letters', () => {
    expect(keyedWpm([press(100), press(100, 700)], 180)).toBe(12);
  });

  it('leaves out the silence between words', () => {
    expect(keyedWpm([press(100), press(100, 5000)], 180)).toBe(12);
  });

  // The SOS from decodeTaps' own test: 21 units in 2700ms is 9.33 wpm.
  it('measures a whole message', () => {
    const dot = (gap: number): TapPress => press(90, gap);
    const dash = (gap: number): TapPress => press(360, gap);
    const sos = [
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
    expect(keyedWpm(sos, 180)).toBe(9);
  });

  it('rounds to the nearest whole word', () => {
    // 1200 / 96 = 12.5
    expect(keyedWpm([press(96)], 180)).toBe(13);
    // 1200 / 130 = 9.23
    expect(keyedWpm([press(130)], 180)).toBe(9);
  });

  it('never reports zero for a slow hand', () => {
    expect(keyedWpm([press(10000)], 180)).toBe(1);
  });

  // The same press is a dash under one cut-off and a dot under another, and
  // a dash is three units of it rather than one.
  it('classifies each mark against the cut-off the decoder uses', () => {
    expect(keyedWpm([press(200)], 180)).toBe(18);
    expect(keyedWpm([press(200)], 300)).toBe(6);
  });

  // Clamped to 80ms, a 100ms silence is inside the letter. Unclamped at 1ms,
  // it would end the word and be left out.
  it('clamps the cut-off the way the decoder does', () => {
    expect(keyedWpm([press(50), press(50, 100)], 1)).toBe(18);
  });

  it('has nothing to report when no time has passed', () => {
    expect(keyedWpm([press(0)], 180)).toBeNull();
  });
});
