/**
 * Where the layout changes shape, and why it changes there.
 *
 * A number in the domain rather than in a stylesheet because the breakpoint is
 * a product decision — which devices get two columns — and because a component
 * that reads it should be testable without a screen.
 */

/**
 * Narrowest width that gets the tablet layout, in points.
 *
 * 768 is the short edge of every iPad in portrait, and the width Android calls
 * a large screen. Below it the two-column layout would give each column less
 * than a phone's worth of room, which is worse than one column.
 */
export const TABLET_MIN_WIDTH = 768;

/**
 * True when the viewport is wide enough for the tablet layout.
 *
 * Width alone, not a device class: a phone-sized window on a tablet, or a
 * split-screen half, should lay out like the space it actually has.
 */
export function isTabletWidth(width: number): boolean {
  return width >= TABLET_MIN_WIDTH;
}

/**
 * Narrowest width at which two columns each still get a phone's worth of room.
 *
 * `TABLET_MIN_WIDTH` says the app has more space than a phone; this says there
 * is enough to genuinely halve. An iPad in portrait is 834pt, which after
 * gutters leaves about 313pt a column — narrower than the phone the layout was
 * drawn for, which is the very thing the comment above warns about.
 *
 * 1024 is an iPad in landscape, and leaves each column about 400pt.
 *
 * Screens whose halves are fluid — a grid of letters, a card of text — are
 * happy at `isTabletWidth`. This is for the ones with a fixed shape to place,
 * where a column too narrow does not reflow, it just cramps.
 */
export const TWO_COLUMN_MIN_WIDTH = 1024;

/** True when the viewport can carry two columns without pinching either. */
export function fitsTwoColumns(width: number): boolean {
  return width >= TWO_COLUMN_MIN_WIDTH;
}
