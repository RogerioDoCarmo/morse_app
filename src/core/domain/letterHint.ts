/**
 * Whether to point at the letter chips, which are silently tappable.
 *
 * ⚠️ A TESTER USED 0.3.4 WITHOUT EVER DISCOVERING THEM. Tapping a chip plays
 * that one letter — the quickest way there is to learn the rhythm — and the
 * card header has said "Tap a letter to hear it" since the screen existed. It
 * was read past. The guide says it too, on its own slide, with a chip drawn
 * and highlighted. That was read past as well.
 *
 * So the chips point at themselves instead: the first one pulses, once, on a
 * message the user has not yet tapped into. Words had two turns.
 *
 * Gated on a VERSION rather than a seen/unseen flag, for the reason
 * {@link FIRST_RUN_VERSION} gives: a boolean can only be spent once, and a
 * release that changes what a chip does could never point at it again.
 */

/** Bumping this makes the hint due again for everyone who has already spent it. */
export const LETTER_HINT_VERSION = 1;

/** The key the satisfied version is stored under. */
export const LETTER_HINT_KEY = 'hint.letterTapSeenVersion';

/**
 * Whether the hint is still owed, given what this device has already learned.
 *
 * Anything unreadable counts as never taught — a missing value on a fresh
 * install and a corrupted one both mean nobody here has tapped a chip. One
 * pulse too many is a moment's flicker; one too few leaves the feature
 * undiscovered, which is the state this was written to end.
 */
export function shouldHintLetterTap(seen: string | null): boolean {
  const version = Number.parseInt(seen ?? '', 10);
  return !Number.isInteger(version) || version < LETTER_HINT_VERSION;
}
