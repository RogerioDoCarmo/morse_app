import { SAMPLE_SEED_KEY, SAMPLE_SEED_VERSION, shouldSeedSample } from './sampleSeed';

describe('whether the Translator seeds its sample', () => {
  it('seeds on a fresh install, where nothing has been stored', () => {
    expect(shouldSeedSample(null)).toBe(true);
  });

  // Unreadable is treated as never seeded: showing the sample twice costs one
  // clear, where never showing it leaves a first-time user with an empty field.
  it.each([[''], ['not a number'], ['NaN'], ['   ']])(
    'seeds when the stored value is unreadable (%p)',
    (stored) => {
      expect(shouldSeedSample(stored)).toBe(true);
    },
  );

  it('does not seed once this version has been seen', () => {
    expect(shouldSeedSample(String(SAMPLE_SEED_VERSION))).toBe(false);
  });

  it('does not seed for a device that has seen a LATER version', () => {
    expect(shouldSeedSample(String(SAMPLE_SEED_VERSION + 1))).toBe(false);
  });

  it('seeds again when the version is bumped past what was seen', () => {
    expect(shouldSeedSample('0')).toBe(true);
  });

  // Literal, not derived from the constant: the whole point of the key is that
  // it is stable across releases, and a self-referential assertion would let a
  // rename through silently, orphaning every existing device's answer.
  it('stores under a key that must not change', () => {
    expect(SAMPLE_SEED_KEY).toBe('seed.translatorSampleSeenVersion');
  });

  it('is at version 1', () => {
    expect(SAMPLE_SEED_VERSION).toBe(1);
  });
});
