import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_LOCALE, type AppLocale } from '@/core/domain/locale';
import { TRANSLATIONS, type TranslationKey } from '@/i18n';
import { usePorts } from './PortsProvider';

type LocaleContextValue = Readonly<{
  /** The interface language. */
  locale: AppLocale;
  /** Switches the interface language. */
  setLocale: (locale: AppLocale) => void;
  /**
   * Looks a string up in the current locale, filling any `{{name}}` holes from
   * `values`. A hole with no value is left as it is rather than blanked, so a
   * missing one shows up in the UI instead of vanishing.
   */
  t: (key: TranslationKey, values?: Readonly<Record<string, string>>) => string;
}>;

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Holds the interface language.
 *
 * Seeds from the device locale on first render, then the user's choice wins.
 * Note this is the **interface** locale only — speech recognition tracks its
 * own, because a device may not have every recogniser installed.
 */
export function LocaleProvider({
  children,
  initialLocale,
}: Readonly<{ children: ReactNode; initialLocale?: AppLocale }>): React.JSX.Element {
  const { locale: localePort } = usePorts();
  const [locale, setLocale] = useState<AppLocale>(
    () => initialLocale ?? localePort.getDeviceLocale(),
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, values) => {
        const value = TRANSLATIONS[locale][key];
        if (values === undefined) return value;
        return value.replace(
          /\{\{(\w+)\}\}/gu,
          (hole, name: string) => values[name] ?? hole,
        );
      },
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Reads the current locale and its lookup function. */
export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (value === null) {
    throw new Error('useLocale must be used inside a LocaleProvider.');
  }
  return value;
}

export { DEFAULT_LOCALE };
