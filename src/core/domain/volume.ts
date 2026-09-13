/**
 * How quiet the device has to be before the app says something.
 *
 * A message on the Sound channel is the one output whose failure is invisible.
 * The torch is either lit or it is not, the screen flashes or it does not, the
 * motor either buzzes in your hand or does not — but a muted phone plays a
 * message that looks, from the screen, exactly like a message that worked: the
 * progress bar runs, the clock counts, the letters light up in order, and the
 * user concludes the app is broken.
 */

/**
 * At or below this, the warning is worth showing.
 *
 * Not at silence: a phone at one or two notches is not silent, it is quiet
 * enough that a 600Hz tone in a room with other people in it is missed — the
 * same failure with a longer explanation.
 *
 * ⚠️ RAISED FROM 30% TO HALF, because 30% did not reach the person it was
 * written for. A tester played messages on 0.3.4 (13) and never saw this
 * warning; the volume that produced that report was therefore ABOVE the old
 * threshold, so the fix is a wider bar and not a narrower one. Half is where a
 * phone stops being reliably audible across a room, and it is still low enough
 * that someone who has deliberately turned the volume down to a working level
 * is not told their phone is too quiet on every message.
 */
export const LOW_VOLUME_LEVEL = 0.5;

/**
 * Whether the device is too quiet for the Sound channel to be heard.
 *
 * `null` means the level could not be read — an older build without the native
 * module, or a platform that refused. That answers NO: a warning shown on a
 * guess would fire on every phone that cannot tell us, which is worse than
 * never showing it at all.
 */
export function isLowVolume(level: number | null): boolean {
  // null and NaN mean the same thing here — "we could not tell" — so null
  // becomes NaN and ONE guard covers both. An explicit `level === null` check
  // beside this would be dead code: `Number.isFinite(null)` is already false,
  // which a mutation run proved by deleting the check and killing nothing.
  //
  // `Number.isFinite` is also doing work `<=` cannot: -Infinity would sail
  // past a comparison as the quietest reading imaginable.
  const reading = level ?? NaN;
  return Number.isFinite(reading) && reading <= LOW_VOLUME_LEVEL;
}
