/**
 * When the Translator seeds its field with the sample message.
 *
 * Gated on a VERSION rather than a seen/unseen flag, for the reason
 * {@link FIRST_RUN_VERSION} gives in full: a boolean can only ever be spent
 * once, so a release that changed the sample could never show it again.
 *
 * ⚠️ NOT the first-run key. The guide writes that one when it is dismissed, and
 * the Translator mounts after — so keyed on first-run the sample would never
 * appear, not even on the launch it exists for. Keeping them separate also
 * means replaying the guide from Settings does not re-seed a field the user has
 * been typing in for months.
 */
export const SAMPLE_SEED_VERSION = 1;

/** The key the seeded version is stored under. */
export const SAMPLE_SEED_KEY = 'seed.translatorSampleSeenVersion';

/**
 * Whether the field should open holding the sample.
 *
 * Anything unreadable counts as never seeded: a missing value on a fresh
 * install and a corrupted one both mean nobody has been shown it. Seeding
 * twice costs a user one clear; never seeding leaves a first-time user looking
 * at an empty field with nothing to press play on.
 */
export function shouldSeedSample(seen: string | null): boolean {
  const version = Number.parseInt(seen ?? '', 10);
  return !Number.isInteger(version) || version < SAMPLE_SEED_VERSION;
}
