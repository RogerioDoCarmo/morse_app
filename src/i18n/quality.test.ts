import { SUPPORTED_LOCALES, type AppLocale } from '../core/domain/locale';
import { TRANSLATIONS, type TranslationKey } from '.';
import { en } from './translations/en';

const KEYS = Object.keys(en) as TranslationKey[];
const OTHER_LOCALES = SUPPORTED_LOCALES.filter((l) => l !== 'en');

/**
 * Quality checks the `TranslationMap` type cannot see.
 *
 * The type already makes a missing key a build error — that is completeness.
 * These guard correctness: that a translation is actually translated, uses the
 * agreed Morse vocabulary, and still fits the box it is drawn in.
 */

/**
 * Character budgets for strings that live in tight chrome, measured from the
 * artboards in `design/screens/`. A ratio against English is the wrong
 * instrument here — "Tap" → "Pulsar" doubles and is completely fine, while a
 * long string growing 20% can still break a row. What breaks layout is
 * absolute width, so these are absolute.
 */
const BUDGETS: Partial<Record<TranslationKey, number>> = {
  'nav.translate': 12,
  'nav.speak': 12,
  'nav.tap': 12,
  'nav.learn': 12,
  'translator.toMorse': 16,
  'translator.toText': 16,
  'translator.speak': 12,
  'translator.tapItIn': 12,
  'translator.flash': 14,
  'translator.readAloud': 20,
  'translator.hint': 34,
  'translator.playing': 16,
  'translator.unsupported': 26,
  'permission.openSettings': 22,
  'permission.notNow': 16,
};

/**
 * Values that are legitimately identical to English, with the reason. Anything
 * else matching English is a string someone forgot to translate.
 */
const SHARED_WITH_ENGLISH: Partial<Record<TranslationKey, readonly AppLocale[]>> = {
  'app.name': ['pt-BR', 'es'], // a proper noun; never translated
  'translator.morseLabel': ['pt-BR', 'es'], // likewise
  'language.interface': ['pt-BR'], // "Interface" is the Portuguese word too
};

/**
 * Domain vocabulary. Morse has settled terms in each language and mixing them
 * reads as a machine translation to anyone who knows the code.
 */
const GLOSSARY: readonly Readonly<{
  concept: string;
  english: RegExp;
  expected: Readonly<Record<'pt-BR' | 'es', RegExp>>;
}>[] = [
  {
    concept: 'dot',
    english: /\bdots?\b/iu,
    expected: { 'pt-BR': /\bpontos?\b/iu, es: /\bpuntos?\b/iu },
  },
  {
    concept: 'dash',
    english: /\bdash(es)?\b/iu,
    expected: { 'pt-BR': /\btraços?\b/iu, es: /\brayas?\b/iu },
  },
];

/** Interpolation tokens, in every shape we might adopt. */
const PLACEHOLDER = /\{\{?\s*\w+\s*\}?\}|%[sd]/gu;

const placeholdersIn = (value: string): string[] =>
  (value.match(PLACEHOLDER) ?? []).sort();

describe('translation quality — untranslated leakage', () => {
  it.each(OTHER_LOCALES)('has no accidental English left in %s', (locale) => {
    const leaked = KEYS.filter((key) => {
      if (TRANSLATIONS[locale][key] !== en[key]) return false;
      return !(SHARED_WITH_ENGLISH[key] ?? []).includes(locale);
    });
    expect(leaked).toEqual([]);
  });

  it('keeps the allowlist honest — every entry is actually identical', () => {
    for (const [key, locales] of Object.entries(SHARED_WITH_ENGLISH)) {
      for (const locale of locales) {
        expect(TRANSLATIONS[locale][key as TranslationKey]).toBe(
          en[key as TranslationKey],
        );
      }
    }
  });
});

describe('translation quality — layout budgets', () => {
  it.each(SUPPORTED_LOCALES)('keeps chrome strings inside their box in %s', (locale) => {
    const over = Object.entries(BUDGETS)
      .map(([key, budget]) => {
        const value = TRANSLATIONS[locale][key as TranslationKey];
        return { key, budget, length: value.length, value };
      })
      .filter((row) => row.length > row.budget);
    expect(over).toEqual([]);
  });

  it('budgets only keys that exist', () => {
    for (const key of Object.keys(BUDGETS)) {
      expect(KEYS).toContain(key);
    }
  });
});

describe('translation quality — glossary', () => {
  it.each(OTHER_LOCALES)('uses the settled Morse vocabulary in %s', (locale) => {
    const wrong: string[] = [];
    for (const term of GLOSSARY) {
      for (const key of KEYS) {
        if (!term.english.test(en[key])) continue;
        const value = TRANSLATIONS[locale][key];
        if (!term.expected[locale].test(value)) {
          wrong.push(`${key} should express "${term.concept}" — got: ${value}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('never translates the word Morse itself', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of KEYS) {
        if (!/\bmorse\b/iu.test(en[key])) continue;
        expect(TRANSLATIONS[locale][key]).toMatch(/\bmorse\b/iu);
      }
    }
  });

  it('actually has vocabulary to check — the glossary is not vacuous', () => {
    for (const term of GLOSSARY) {
      expect(KEYS.some((key) => term.english.test(en[key]))).toBe(true);
    }
  });
});

describe('translation quality — placeholders', () => {
  it.each(OTHER_LOCALES)('carries the same interpolation tokens in %s', (locale) => {
    const mismatched = KEYS.filter(
      (key) =>
        placeholdersIn(en[key]).join('|') !==
        placeholdersIn(TRANSLATIONS[locale][key]).join('|'),
    );
    expect(mismatched).toEqual([]);
  });

  it('detects a mismatch when there is one', () => {
    // No string interpolates yet, so the check above passes trivially. This
    // proves the detector works, so it is a guard rather than false comfort.
    expect(placeholdersIn('Hello {{name}}')).toEqual(['{{name}}']);
    expect(placeholdersIn('Olá')).toEqual([]);
    expect(placeholdersIn('%s of %d')).toEqual(['%d', '%s']);
  });
});
