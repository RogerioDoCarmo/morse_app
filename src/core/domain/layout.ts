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
