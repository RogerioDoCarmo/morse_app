import { LETTER_HINT_KEY, LETTER_HINT_VERSION, shouldHintLetterTap } from './letterHint';

describe('pointing at the letter chips', () => {
  // Literal, not read back off the module: an assertion that restates the
  // constant would agree with any value, including one a mutant chose.
  it('is stored under a key of its own', () => {
    expect(LETTER_HINT_KEY).toBe('hint.letterTapSeenVersion');
  });

  it('is on its first version', () => {
    expect(LETTER_HINT_VERSION).toBe(1);
  });

  it('is owed on a fresh install, where nothing is stored', () => {
    expect(shouldHintLetterTap(null)).toBe(true);
  });

  it('is owed when the stored value is not a number at all', () => {
    expect(shouldHintLetterTap('corrupted')).toBe(true);
  });

  it('is owed when the stored value is empty', () => {
    expect(shouldHintLetterTap('')).toBe(true);
  });

  /**
   * ⚠️ A device that has seen an OLDER hint is owed the new one. This is the
   * whole reason the stored value is a version and not a `true`: a release
   * that changes what tapping a chip does has to be able to point again.
   */
  it('is owed again when the device only saw an earlier version', () => {
    expect(shouldHintLetterTap('0')).toBe(true);
  });

  it('is spent once the device has seen this version', () => {
    expect(shouldHintLetterTap('1')).toBe(false);
  });

  // A version AHEAD of this build — a downgrade, or a restored backup. It has
  // been taught something at least as new, so it is not owed anything.
  it('is spent when the device has seen a later version', () => {
    expect(shouldHintLetterTap('2')).toBe(false);
  });

  // `parseInt` stops at the first character it cannot use, so a stored "1x"
  // reads as 1. That is deliberately fine: it means satisfied, and the
  // alternative is pulsing at someone whose storage was scrambled.
  it('reads a number with rubbish after it as that number', () => {
    expect(shouldHintLetterTap('1x')).toBe(false);
  });
});
