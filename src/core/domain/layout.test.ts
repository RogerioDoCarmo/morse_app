import { TABLET_MIN_WIDTH, isTabletWidth } from './layout';

describe('the tablet breakpoint', () => {
  // A literal, not a reference to the constant: a test that reads the constant
  // passes whatever it becomes.
  it('sits at 768 points', () => {
    expect(TABLET_MIN_WIDTH).toBe(768);
  });

  it.each([
    ['an iPhone 16 Pro', 402],
    ['a small phone', 320],
    ['a large phone in landscape', 767],
  ])('gives %s the phone layout', (_label, width) => {
    expect(isTabletWidth(width)).toBe(false);
  });

  it.each([
    ['an iPad in portrait', 768],
    ['an iPad in landscape', 1180],
    ['a desktop-sized window', 1440],
  ])('gives %s the tablet layout', (_label, width) => {
    expect(isTabletWidth(width)).toBe(true);
  });

  // The boundary belongs to exactly one side, and it is the tablet's.
  it('includes the breakpoint itself and excludes the point below it', () => {
    expect(isTabletWidth(768)).toBe(true);
    expect(isTabletWidth(767)).toBe(false);
  });

  // A width of zero arrives during the first layout pass on some platforms.
  it('treats an unmeasured width as a phone', () => {
    expect(isTabletWidth(0)).toBe(false);
  });
});
