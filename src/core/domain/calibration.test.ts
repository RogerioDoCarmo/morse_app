import { CALIBRATION_MARKS, MIN_DASH_TO_DOT_RATIO, calibrateUnitMs } from './calibration';

describe('calibrateUnitMs', () => {
  it('asks for three dots and then three dashes', () => {
    expect(CALIBRATION_MARKS).toEqual({ dots: 3, dashes: 3 });
  });

  it('puts the cut-off at the geometric mean of the two medians, on the slider step', () => {
    // Medians 110 and 330: sqrt(36300) = 190.5, which the 10ms step makes 190.
    expect(calibrateUnitMs([100, 120, 110], [330, 360, 300])).toBe(190);
  });

  it('rounds to the nearest step, up as well as down', () => {
    // sqrt(100 * 400) = 200 exactly; sqrt(120 * 400) = 219.1 → 220.
    expect(calibrateUnitMs([100], [400])).toBe(200);
    expect(calibrateUnitMs([120], [400])).toBe(220);
  });

  it('reads the median, so one fumbled press does not drag the result', () => {
    // A 900ms dot is a slip; the median of the three is still 100.
    expect(calibrateUnitMs([100, 900, 100], [400, 400, 400])).toBe(200);
  });

  it('sorts numerically before taking the median', () => {
    // Sorted as strings this would be [100, 90, 95] and the median 90.
    expect(calibrateUnitMs([100, 95, 90], [380, 380, 380])).toBe(190);
  });

  it('averages the middle two of an even count', () => {
    // Median dot 150, median dash 600: sqrt(90000) = 300.
    expect(calibrateUnitMs([100, 200], [500, 700])).toBe(300);
    // Of four, only the middle two: 120 and 180, so 150 — not the 325 that
    // all four would average to.
    expect(calibrateUnitMs([100, 120, 180, 900], [600])).toBe(300);
  });

  it('keeps the result inside the range the settings slider offers', () => {
    expect(calibrateUnitMs([40, 40, 40], [100, 100, 100])).toBe(80);
    expect(calibrateUnitMs([300, 300, 300], [3000, 3000, 3000])).toBe(400);
  });

  it('refuses when the dashes are not clearly longer than the dots', () => {
    expect(MIN_DASH_TO_DOT_RATIO).toBe(1.5);
    expect(calibrateUnitMs([200, 200, 200], [290, 290, 290])).toBeNull();
    // Dashes SHORTER than the dots, which is a hand that swapped them.
    expect(calibrateUnitMs([300, 300, 300], [100, 100, 100])).toBeNull();
  });

  it('accepts a dash exactly one and a half dots long', () => {
    // sqrt(200 * 300) = 244.9 → 240.
    expect(calibrateUnitMs([200], [300])).toBe(240);
  });

  it('refuses with nothing to measure', () => {
    expect(calibrateUnitMs([], [300])).toBeNull();
    expect(calibrateUnitMs([100], [])).toBeNull();
  });

  it('refuses durations that are not positive numbers', () => {
    expect(calibrateUnitMs([0], [300])).toBeNull();
    expect(calibrateUnitMs([Number.NaN], [300])).toBeNull();
    expect(calibrateUnitMs([100], [Number.POSITIVE_INFINITY])).toBeNull();
  });
});
