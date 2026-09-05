/**
 * The preferences the user can change, and how they survive a relaunch.
 *
 * Parsing lives in the domain rather than in the provider because every stored
 * value arrives as an untrusted string — written by an older build of the app,
 * corrupted, or hand-edited on a rooted device — and the rule for what a bad
 * value means is a decision about the app, not about storage.
 *
 * The interface language is deliberately absent: `LocaleProvider` already owns
 * it, and two owners for one value is how they drift apart.
 */
import { isAppLocale, type AppLocale } from './locale';
import { clampUnitMs, DEFAULT_UNIT_MS } from './tapping';
import { DEFAULT_PLAYBACK_WPM } from './timeline';

/**
 * One key per setting rather than a single JSON blob. A blob fails as a unit:
 * one unparseable field and every other setting resets with it.
 */
export const SETTINGS_KEYS = Object.freeze({
  tapUnitMs: 'settings.tapUnitMs',
  playbackWpm: 'settings.playbackWpm',
  speakDecoded: 'settings.speakDecoded',
  crashReports: 'settings.crashReports',
  speechLocale: 'settings.speechLocale',
});

/**
 * What is stored when speech recognition follows the interface.
 *
 * A sentinel rather than an absent key: the port can write but not delete, so
 * "follow" has to be a value a user can go back to, not just the state of
 * never having chosen.
 */
export const SPEECH_FOLLOWS_INTERFACE = 'follow';

/** The speeds the picker offers, in words per minute. */
export const PLAYBACK_WPM_CHOICES: readonly number[] = Object.freeze([5, 10, 15]);

/** Everything the user can change, as one object. */
export type Settings = Readonly<{
  /** Press durations at or above this many ms count as a dash. */
  tapUnitMs: number;
  /** Playback speed, in words per minute. */
  playbackWpm: number;
  /** Read decoded text aloud as soon as it is decoded. */
  speakDecoded: boolean;
  /** Send crash reports off the device. */
  crashReports: boolean;
  /**
   * Which language the microphone listens for, or `null` to follow the
   * interface. Separate from the interface language because a device may
   * simply not have a given recogniser installed.
   */
  speechLocale: AppLocale | null;
}>;

export const DEFAULT_SETTINGS: Settings = Object.freeze({
  tapUnitMs: DEFAULT_UNIT_MS,
  playbackWpm: DEFAULT_PLAYBACK_WPM,
  speakDecoded: true,
  crashReports: true,
  speechLocale: null,
});

/**
 * Reads a stored cut-off.
 *
 * No guard for junk input: `parseInt` turns it into `NaN`, and `clampUnitMs`
 * already answers `NaN` with the default. A branch here would be a second
 * place for the same decision to live.
 */
export function parseTapUnitMs(raw: string | null): number {
  return clampUnitMs(Number.parseInt(raw ?? '', 10));
}

/**
 * Reads a stored speed, accepting only the speeds the picker actually offers.
 *
 * A value the picker cannot show would be a setting the user can leave but
 * never return to, so an unrecognised one falls back rather than persisting.
 */
export function parsePlaybackWpm(raw: string | null): number {
  const wpm = Number.parseInt(raw ?? '', 10);
  return PLAYBACK_WPM_CHOICES.includes(wpm) ? wpm : DEFAULT_SETTINGS.playbackWpm;
}

/**
 * Reads a stored flag.
 *
 * Only the two strings `serialiseFlag` writes count. Anything else — including
 * `'1'`, `'yes'` and `''` — is treated as never having been stored, so a
 * setting the user has not touched keeps whatever default it ships with.
 */
export function parseFlag(raw: string | null, fallback: boolean): boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fallback;
}

/** The inverse of {@link parseFlag}. */
export function serialiseFlag(value: boolean): string {
  return value ? 'true' : 'false';
}

/**
 * Reads a stored speech locale.
 *
 * Everything that is not a language this app speaks means "follow the
 * interface" — including the sentinel, an unset key, and a locale dropped in
 * a later release. Falling back to following is the one answer that is always
 * usable, since the interface locale is always one the app has.
 */
export function parseSpeechLocale(raw: string | null): AppLocale | null {
  return isAppLocale(raw) ? raw : null;
}

/** The inverse of {@link parseSpeechLocale}. */
export function serialiseSpeechLocale(locale: AppLocale | null): string {
  return locale ?? SPEECH_FOLLOWS_INTERFACE;
}

/** Rebuilds the whole settings object from what storage returned. */
export function parseSettings(stored: Readonly<Record<string, string | null>>): Settings {
  return {
    tapUnitMs: parseTapUnitMs(stored[SETTINGS_KEYS.tapUnitMs] ?? null),
    playbackWpm: parsePlaybackWpm(stored[SETTINGS_KEYS.playbackWpm] ?? null),
    speakDecoded: parseFlag(
      stored[SETTINGS_KEYS.speakDecoded] ?? null,
      DEFAULT_SETTINGS.speakDecoded,
    ),
    crashReports: parseFlag(
      stored[SETTINGS_KEYS.crashReports] ?? null,
      DEFAULT_SETTINGS.crashReports,
    ),
    speechLocale: parseSpeechLocale(stored[SETTINGS_KEYS.speechLocale] ?? null),
  };
}
