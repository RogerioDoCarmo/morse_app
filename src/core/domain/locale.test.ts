import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isAppLocale, resolveLocale } from './locale';

describe('resolveLocale', () => {
  it.each([
    ['en', 'en'],
    ['en-GB', 'en'],
    ['pt-BR', 'pt-BR'],
    ['pt-PT', 'pt-BR'],
    ['pt', 'pt-BR'],
    ['es', 'es'],
    ['es-MX', 'es'],
    ['es_AR', 'es'],
  ])('maps %s to %s', (tag, expected) => {
    expect(resolveLocale(tag)).toBe(expected);
  });

  it.each([['fr'], ['de-DE'], [''], [null], [undefined]])(
    'falls back to English for %s',
    (tag) => {
      expect(resolveLocale(tag)).toBe(DEFAULT_LOCALE);
    },
  );
});

describe('isAppLocale', () => {
  it('accepts exactly the supported tags', () => {
    for (const locale of SUPPORTED_LOCALES) expect(isAppLocale(locale)).toBe(true);
    expect(isAppLocale('pt')).toBe(false);
    expect(isAppLocale('fr')).toBe(false);
  });
});
