/**
 * Locales, and the distinction between the two that this app tracks.
 *
 * The interface locale and the speech-recognition locale are separate: a device
 * may simply not have a given recogniser installed, so recognition follows the
 * interface by default but can be overridden.
 */

/** The languages the interface is fully translated into. */
export type AppLocale = 'en' | 'pt-BR' | 'es';

/** Falls back to English when the OS reports something we do not translate. */
export const DEFAULT_LOCALE: AppLocale = 'en';

/** Every supported locale, in the order the picker lists them. */
export const SUPPORTED_LOCALES: readonly AppLocale[] = Object.freeze([
  'en',
  'pt-BR',
  'es',
]);

/**
 * Narrows an arbitrary value to a supported locale.
 *
 * Accepts null and undefined so callers reading from storage or the OS do not
 * need a null check of their own — an absent value is simply not a locale.
 */
export const isAppLocale = (value: string | null | undefined): value is AppLocale =>
  (SUPPORTED_LOCALES as readonly string[]).includes(value as string);

/**
 * Maps an OS locale tag onto a supported one.
 *
 * Matches on the language subtag, so `pt-PT` and `es-MX` still land on a
 * translated interface rather than falling all the way back to English.
 */
export function resolveLocale(tag: string | null | undefined): AppLocale {
  if (!tag) return DEFAULT_LOCALE;
  if (isAppLocale(tag)) return tag;

  const language = tag.toLowerCase().split(/[-_]/u)[0];
  if (language === 'pt') return 'pt-BR';
  if (language === 'es') return 'es';
  if (language === 'en') return 'en';
  return DEFAULT_LOCALE;
}
