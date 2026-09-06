import type { AppLocale } from '../core/domain/locale';
import type { TranslationMap } from './keys';
import { en } from './translations/en';
import { es } from './translations/es';
import { ptBR } from './translations/pt';

export type { TranslationKey, TranslationMap } from './keys';

/**
 * Every locale's strings, keyed by tag. Adding a locale here without a
 *  complete `TranslationMap` is a compile error.
 */
export const TRANSLATIONS: Readonly<Record<AppLocale, TranslationMap>> = Object.freeze({
  en,
  'pt-BR': ptBR,
  es,
});
