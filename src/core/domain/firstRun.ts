/**
 * When the first-run guide is shown.
 *
 * Gated on a VERSION rather than a seen/unseen flag. A boolean can only ever
 * be spent once, so a release that adds a channel worth explaining could never
 * show the guide again. Bumping this number brings it back for everyone,
 * including people who have used the app for a year.
 *
 * ⚠️ Bumping it shows the guide to every existing user. Only do it when the
 * guide has something new to say, and rewrite the slides in the same change.
 */
export const FIRST_RUN_VERSION = 1;

/** The key the seen version is stored under. */
export const FIRST_RUN_KEY = 'firstRun.seenVersion';

/**
 * Whether the guide should be shown, given what this device has already seen.
 *
 * Anything unreadable counts as never seen: a missing value on a fresh
 * install, and a corrupted one, both mean nobody has been shown the guide.
 * Showing it twice is a small annoyance; never showing it leaves the outputs
 * undiscoverable, which is the whole reason it exists.
 */
export function shouldShowFirstRun(seen: string | null): boolean {
  const version = Number.parseInt(seen ?? '', 10);
  return !Number.isInteger(version) || version < FIRST_RUN_VERSION;
}
