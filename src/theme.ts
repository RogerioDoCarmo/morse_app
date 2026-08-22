/**
 * Design tokens, transcribed from `design/README.md`.
 *
 * The design canvas is HTML/CSS and does not compile into this app, so these
 * values are the hand-carried contract between the two. Change them here and
 * in the design together.
 */
export const theme = Object.freeze({
  color: Object.freeze({
    ink: '#101820',
    muted: '#6a7480',
    faint: '#9aa3ad',
    ground: '#f5f6f8',
    groundAlt: '#f2f4f7',
    surface: '#ffffff',
    border: '#eef0f3',
    accent: '#12a594',
    accentTint: '#e7f6f3',
    accentDeep: '#0d7d70',
  }),
  radius: Object.freeze({ card: 22, control: 14, pill: 999 }),
  spacing: Object.freeze({ xs: 6, sm: 8, md: 12, lg: 18, xl: 24 }),
  /** Minimum touch target, in points. Nothing interactive may be smaller. */
  hitTarget: 44,
});
