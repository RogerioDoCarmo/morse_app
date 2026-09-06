/**
 * Design tokens, transcribed from `design/README.md` and the artboards in
 * `design/screens/`.
 *
 * The design canvas is HTML/CSS and does not compile into this app, so these
 * values are the hand-carried contract between the two. Change them here and
 * in the design together.
 */

/** Font families, as registered by `useAppFonts`. */
export const fontFamily = Object.freeze({
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
});

export const theme = Object.freeze({
  color: Object.freeze({
    ink: '#101820',
    muted: '#6a7480',
    faint: '#9aa3ad',
    ground: '#f5f6f8',
    groundAlt: '#f2f4f7',
    surface: '#ffffff',
    border: '#eef0f3',
    track: '#e8ebef',
    accent: '#12a594',
    accentTint: '#e7f6f3',
    accentDeep: '#0d7d70',
    onAccent: '#ffffff',
    onInk: '#ffffff',
  }),
  radius: Object.freeze({ card: 22, control: 14, chip: 16, pill: 999 }),
  spacing: Object.freeze({ xs: 6, sm: 8, md: 12, lg: 18, xl: 24 }),
  /** Screen gutter, from the artboards' 20px horizontal padding. */
  gutter: 20,
  /** Minimum touch target, in points. Nothing interactive may be smaller. */
  hitTarget: 44,
  font: fontFamily,
  /**
   * Card elevation. The artboards layer two shadows — a tight contact shadow
   * and a wide ambient one. React Native 0.76+ on the New Architecture takes
   * `boxShadow` as an array, so the recipe survives translation intact instead
   * of collapsing to a single iOS shadow plus an Android elevation guess.
   */
  shadow: Object.freeze({
    card: [
      { offsetX: 0, offsetY: 1, blurRadius: 2, color: 'rgba(16, 24, 32, 0.04)' },
      { offsetX: 0, offsetY: 10, blurRadius: 26, color: 'rgba(16, 24, 32, 0.05)' },
    ],
    control: [
      { offsetX: 0, offsetY: 1, blurRadius: 2, color: 'rgba(16, 24, 32, 0.05)' },
      { offsetX: 0, offsetY: 4, blurRadius: 10, color: 'rgba(16, 24, 32, 0.06)' },
    ],
    raised: [
      { offsetX: 0, offsetY: 1, blurRadius: 2, color: 'rgba(16, 24, 32, 0.04)' },
      { offsetX: 0, offsetY: 6, blurRadius: 16, color: 'rgba(16, 24, 32, 0.06)' },
    ],
  }),
  /**
   * Type scale. `letterSpacing` is in POINTS here — the artboards express it in
   * `em`, which React Native has no notion of, so each value is the em figure
   * multiplied by its own font size rather than copied across.
   */
  type: Object.freeze({
    wordmark: { fontFamily: fontFamily.extrabold, fontSize: 22, letterSpacing: -0.55 },
    title: { fontFamily: fontFamily.extrabold, fontSize: 24, letterSpacing: -0.6 },
    input: {
      fontFamily: fontFamily.semibold,
      fontSize: 26,
      letterSpacing: -0.52,
      lineHeight: 33,
    },
    decoded: {
      fontFamily: fontFamily.bold,
      fontSize: 32,
      letterSpacing: -0.8,
      lineHeight: 38,
    },
    label: { fontFamily: fontFamily.bold, fontSize: 12, letterSpacing: 0.36 },
    body: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 21 },
    control: { fontFamily: fontFamily.bold, fontSize: 14 },
    controlIdle: { fontFamily: fontFamily.semibold, fontSize: 14 },
    action: { fontFamily: fontFamily.bold, fontSize: 15 },
    chip: { fontFamily: fontFamily.bold, fontSize: 13 },
    hint: { fontFamily: fontFamily.medium, fontSize: 12 },
    tab: { fontFamily: fontFamily.bold, fontSize: 11 },
    tabIdle: { fontFamily: fontFamily.semibold, fontSize: 11 },
    mono: { fontFamily: fontFamily.mono, fontSize: 12 },
    monoLarge: { fontFamily: fontFamily.mono, fontSize: 16, lineHeight: 28 },
    letter: { fontFamily: fontFamily.monoMedium, fontSize: 11 },
  }),
});
