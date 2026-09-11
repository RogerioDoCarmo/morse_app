import fc from 'fast-check';
import { LOW_VOLUME_LEVEL, isLowVolume } from './volume';

describe('isLowVolume', () => {
  // Literal values, not `LOW_VOLUME_LEVEL ± something` — an assertion written
  // against the constant passes whatever the constant becomes, which is the
  // one thing a threshold test must not do.
  it.each([
    [0, true],
    [0.1, true],
    [0.29, true],
    [0.3, true],
    [0.31, false],
    [0.5, false],
    [1, false],
  ])('reads %f as low: %s', (level, expected) => {
    expect(isLowVolume(level)).toBe(expected);
  });

  // "At or below", not "below". A phone sitting exactly on the threshold is
  // quiet enough to miss the message, and off-by-one here is the difference
  // between warning at two notches and warning at three.
  it('includes the threshold itself', () => {
    expect(isLowVolume(LOW_VOLUME_LEVEL)).toBe(true);
  });

  it('is 0.3, which is what "30% or lower" means', () => {
    expect(LOW_VOLUME_LEVEL).toBe(0.3);
  });

  /**
   * The quiet answer. A build without the native module, or a platform that
   * refused the read, reports null — and a warning shown on a guess would
   * fire on every device that cannot tell us, which is worse than never
   * showing it.
   */
  it('says nothing when the level could not be read', () => {
    expect(isLowVolume(null)).toBe(false);
  });

  it.each([NaN, Infinity, -Infinity])('says nothing for %p', (level) => {
    expect(isLowVolume(level)).toBe(false);
  });

  it('never warns above the threshold, for any level a device can report', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (level) => {
        expect(isLowVolume(level)).toBe(level <= 0.3);
      }),
    );
  });
});
