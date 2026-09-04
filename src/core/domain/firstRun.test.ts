import { FIRST_RUN_KEY, FIRST_RUN_VERSION, shouldShowFirstRun } from './firstRun';

describe('shouldShowFirstRun', () => {
  it('shows it on a fresh install', () => {
    expect(shouldShowFirstRun(null)).toBe(true);
  });

  it('does not show it again to someone who has seen this version', () => {
    expect(shouldShowFirstRun(String(FIRST_RUN_VERSION))).toBe(false);
  });

  // The point of a version rather than a flag: a release that adds something
  // worth explaining can bring the guide back.
  it('shows it again to someone who only saw an older version', () => {
    expect(shouldShowFirstRun('0')).toBe(true);
  });

  it('leaves someone from the future alone', () => {
    expect(shouldShowFirstRun(String(FIRST_RUN_VERSION + 1))).toBe(false);
  });

  // Showing it twice is a small annoyance; never showing it leaves the output
  // channels undiscoverable, which is the whole reason it exists.
  it('treats anything unreadable as never seen', () => {
    expect(shouldShowFirstRun('')).toBe(true);
    expect(shouldShowFirstRun('not a number')).toBe(true);
    expect(shouldShowFirstRun('NaN')).toBe(true);
  });

  it('names the version and the key it is stored under', () => {
    expect(FIRST_RUN_VERSION).toBe(1);
    expect(FIRST_RUN_KEY).toBe('firstRun.seenVersion');
  });
});
