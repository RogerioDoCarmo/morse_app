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
    // ⚠️ The readings that prompted the change. A phone at 40-50% is plainly
    // audible in a quiet room and was warned about on every chip press.
    [0.31, false],
    [0.4, false],
    [0.5, false],
    [0.8, false],
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

  /**
   * ⚠️ 0.3, RESTORED — asserted as the literal it is, because an assertion
   * written against the constant passes whatever the constant becomes.
   *
   * It had been raised to 0.5 because a tester never saw the warning on
   * 0.3.4 (13), read at the time as "the bar is too low". The real cause was
   * found later and fixed in #198: `playLetter` NEVER READ THE VOLUME AT ALL.
   * The tester saw nothing because nothing was checked.
   *
   * Half then over-fired, reported from a device on 23 September: the volume
   * was up, the audio audible, and the toast appeared on every press.
   */
  it('is 0.3, low enough that an audible phone is not warned', () => {
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
        // ⚠️ 0.3, THE CURRENT THRESHOLD. This said 0.5 — the old one — and went
        // on saying it after the threshold moved, so for every level in the
        // 0.3-to-0.5 band the property asserted the opposite of the behaviour.
        // It survived because `fc.double` leans hard on the edges of its range
        // and rarely sampled that band: the suite passed run after run and then
        // failed on the counterexample 0.30000000000000004.
        //
        // ⚠️ A property that restates the constant cannot catch this. It has to
        // be the literal, and the literal has to move when the constant does.
        expect(isLowVolume(level)).toBe(level <= 0.3);
      }),
    );
  });
});
