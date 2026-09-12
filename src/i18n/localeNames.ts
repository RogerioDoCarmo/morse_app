import type { AppLocale } from '@/core/domain/locale';

/**
 * Endonyms: a language is listed the way its own speakers write it.
 *
 * ⚠️ ONE copy, imported by both screens. The Language screen owned these and
 * the header menu needed the same three strings — a second copy is a promise
 * that two lists of the same three languages will disagree eventually, and the
 * one that drifts is the one nobody opens.
 *
 * Not translated, deliberately. A language picker that names its options in a
 * language the reader cannot read is the one screen where translation makes
 * things worse: someone who opened it by accident, in a language they do not
 * speak, has to find their way out of it.
 */
export const NATIVE_LOCALE_NAMES: Readonly<Record<AppLocale, string>> = {
  en: 'English',
  'pt-BR': 'Português (Brasil)',
  es: 'Español',
};

/**
 * The two-letter badge shown in the Translator header.
 *
 * `pt-BR` is the only tag whose first half is not what a reader expects to see
 * — `PT-BR` is too wide for the badge and `PT` is what the flag of the
 * language says to a Brazilian.
 */
export function localeBadge(locale: AppLocale): string {
  return locale === 'pt-BR' ? 'PT' : locale.toUpperCase();
}
