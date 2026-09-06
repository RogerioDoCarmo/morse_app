import { getLocales } from 'expo-localization';
import { DEFAULT_LOCALE, resolveLocale } from '@/core/domain/locale';
import type { ILocalePort } from '@/core/ports';

/** Reads the OS locale and narrows it to one the app translates. */
export function createExpoLocalizationAdapter(): ILocalePort {
  return {
    getDeviceLocale() {
      const [first] = getLocales();
      return first ? resolveLocale(first.languageTag) : DEFAULT_LOCALE;
    },
  };
}
