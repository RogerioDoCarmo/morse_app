import type { AppLocale } from '../domain/locale';

/** Reads the locale the OS reports. */
export interface ILocalePort {
  /** The device locale, already narrowed to one this app translates. */
  getDeviceLocale(): AppLocale;
}
