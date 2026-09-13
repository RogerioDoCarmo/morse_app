import { PLAYBACK_WPM_CHOICES } from './timeline';

/**
 * Switches for turning parts of the app off without deleting them.
 *
 * ⚠️ THIS FILE IS THE WHOLE MECHANISM, and that is deliberate. Everything is
 * ON by default and turning something off is a one-line edit here — no new
 * plumbing, no conditionals scattered through screens. It exists so a defect
 * found on a tester's phone can be contained in minutes rather than waiting
 * for a fix, which matters when a build needs a machine that may not be
 * available.
 *
 * ⚠️ It is NOT a place for permanent configuration. A flag that has been off
 * for a release is either a bug nobody fixed or a feature nobody wants; say
 * which, and then either fix it or delete the code.
 *
 * The lists below name what is turned OFF, rather than what is left on. A list
 * of exceptions stays empty in the healthy case, so the diff that disables
 * something is one line and reads as what it is.
 *
 * Remote Config is the eventual home for these — see NEXT-STEPS. Until then a
 * flag change needs a build like any other code change.
 *
 * ⚠️ The two readers take the withheld list as an OPTIONAL PARAMETER, and that
 * is for the tests rather than for callers — nothing in the app passes it. The
 * guards below are the part most likely to matter on the day someone reaches
 * for this in a hurry, and a guard that cannot be exercised is a guard nobody
 * has checked.
 */

/** Every output the Translator can send a message on. */
export const OUTPUT_CHANNELS = Object.freeze([
  'sound',
  'light',
  'screen',
  'buzz',
] as const);

/** One of the four outputs a message can be sent on. */
export type OutputChannel = (typeof OUTPUT_CHANNELS)[number];

/**
 * Playback speeds to withhold from Settings, in words per minute.
 *
 * ⚠️ Empty, and it should stay that way. A tester lost the last letter of
 * every message above 5 wpm in 0.3.4 (13), which looked like grounds for
 * disabling 10 and 15 — but the cause turned out to be the run's clock cutting
 * audio it had never waited for, not the speeds themselves. Disabling them
 * would have hidden a bug that took an afternoon to find and one line to fix.
 */
export const DISABLED_PLAYBACK_WPM: readonly number[] = Object.freeze([]);

/** Output channels to withhold from the Translator. */
export const DISABLED_OUTPUT_CHANNELS: readonly OutputChannel[] = Object.freeze([]);

/**
 * The speeds Settings may offer.
 *
 * ⚠️ Never empty. Disabling every speed would leave the picker blank and the
 * app unable to play at any rate at all, so the full list comes back rather
 * than obeying a flag that cannot have been meant.
 */
export function enabledPlaybackWpm(
  disabled: readonly number[] = DISABLED_PLAYBACK_WPM,
): readonly number[] {
  const left = PLAYBACK_WPM_CHOICES.filter((wpm) => !disabled.includes(wpm));
  return left.length > 0 ? left : PLAYBACK_WPM_CHOICES;
}

/**
 * The channels the Translator may offer.
 *
 * ⚠️ Never empty, for the same reason: with no channels there is nothing to
 * send a message on, and the Emit button would be permanently disabled with
 * nothing on screen explaining why.
 */
export function enabledOutputChannels(
  disabled: readonly OutputChannel[] = DISABLED_OUTPUT_CHANNELS,
): readonly OutputChannel[] {
  const left = OUTPUT_CHANNELS.filter((channel) => !disabled.includes(channel));
  return left.length > 0 ? left : OUTPUT_CHANNELS;
}

/** Whether one channel may be offered and played. */
export function isOutputChannelEnabled(channel: OutputChannel): boolean {
  return enabledOutputChannels().includes(channel);
}

/**
 * Whether one speed may be offered.
 *
 * ⚠️ Used by the settings parser as well as the picker. A stored speed that
 * has since been disabled would otherwise leave a user on a rate the picker
 * cannot show — a setting they can leave but never return to.
 */
export function isPlaybackWpmEnabled(wpm: number): boolean {
  return enabledPlaybackWpm().includes(wpm);
}
