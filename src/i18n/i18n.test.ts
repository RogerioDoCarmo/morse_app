import { SUPPORTED_LOCALES } from '../core/domain/locale';
import { TRANSLATIONS } from '.';
import { en } from './translations/en';

const KEYS = Object.keys(en) as (keyof typeof en)[];

describe('translations', () => {
  it('covers every supported locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(TRANSLATIONS[locale]).toBeDefined();
    }
    expect(Object.keys(TRANSLATIONS).sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  // The TranslationMap type already makes a missing key a build error. This
  // guards the things the type cannot see: an empty string, or a key that was
  // copied across locales without being translated.
  it.each(SUPPORTED_LOCALES)('has a non-empty string for every key in %s', (locale) => {
    for (const key of KEYS) {
      const value = TRANSLATIONS[locale][key];
      expect(typeof value).toBe('string');
      expect(value.trim()).not.toBe('');
    }
  });

  it('has the same key set in every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(TRANSLATIONS[locale]).sort()).toEqual([...KEYS].sort());
    }
  });

  it('actually translates the navigation, rather than leaving English in place', () => {
    // Proper nouns and words that are genuinely identical are excluded; these
    // four are the ones that would silently expose an untranslated UI.
    const navKeys = ['nav.translate', 'nav.speak', 'nav.tap', 'nav.learn'] as const;
    for (const key of navKeys) {
      expect(TRANSLATIONS['pt-BR'][key]).not.toBe(TRANSLATIONS.en[key]);
      expect(TRANSLATIONS.es[key]).not.toBe(TRANSLATIONS.en[key]);
    }
  });
});
