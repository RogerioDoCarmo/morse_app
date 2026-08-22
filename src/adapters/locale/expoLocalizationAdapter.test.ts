import { getLocales } from 'expo-localization';
import { createExpoLocalizationAdapter } from './expoLocalizationAdapter';

jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));
const mockGetLocales = jest.mocked(getLocales);

type Locales = ReturnType<typeof getLocales>;

/** A device locale list carrying only the field the adapter reads. */
const deviceLocales = (...tags: string[]): Locales =>
  tags.map((languageTag) => ({ languageTag })) as unknown as Locales;

describe('expoLocalizationAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['pt-BR', 'pt-BR'],
    ['es-MX', 'es'],
    ['en-GB', 'en'],
    ['fr-FR', 'en'],
  ])('narrows the device tag %s to %s', (languageTag, expected) => {
    mockGetLocales.mockReturnValue(deviceLocales(languageTag));
    expect(createExpoLocalizationAdapter().getDeviceLocale()).toBe(expected);
  });

  it('falls back to English when the OS reports no locale at all', () => {
    // The type says the list is non-empty; the runtime does not always agree,
    // which is exactly why the adapter guards it.
    mockGetLocales.mockReturnValue(deviceLocales());
    expect(createExpoLocalizationAdapter().getDeviceLocale()).toBe('en');
  });
});
