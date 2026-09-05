import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePorts } from '@/application/providers/PortsProvider';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEYS,
  parseSettings,
  serialiseFlag,
  type Settings,
} from '@/core/domain/settings';
import { clampUnitMs } from '@/core/domain/tapping';

type SettingsContextValue = Readonly<{
  settings: Settings;
  /**
   * False until storage has answered. Screens that would visibly jump when the
   * real values arrive — the tap key, the speed picker — wait on this.
   */
  ready: boolean;
  setTapUnitMs: (ms: number) => void;
  setPlaybackWpm: (wpm: number) => void;
  setSpeakDecoded: (on: boolean) => void;
  setCrashReports: (on: boolean) => void;
}>;

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * Holds the user's preferences, and writes each change back.
 *
 * Every setter updates state first and persists without awaiting: a setting
 * that took a round-trip to storage before moving would make the switch feel
 * broken. A failed write costs the user the value on next launch, which the
 * adapter reports — it does not cost them the change they just made.
 */
export function SettingsProvider({
  children,
}: Readonly<{ children: ReactNode }>): React.JSX.Element {
  const { preferences, crash } = usePorts();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let listening = true;
    const keys = Object.values(SETTINGS_KEYS);
    void Promise.all(keys.map((key) => preferences.read(key))).then((values) => {
      if (!listening) return;
      setSettings(
        parseSettings(Object.fromEntries(keys.map((key, i) => [key, values[i] ?? null]))),
      );
      setReady(true);
    });
    return () => {
      listening = false;
    };
  }, [preferences]);

  const setTapUnitMs = useCallback(
    (ms: number): void => {
      // Clamped here as well as on the way out of storage, so a caller that
      // computes a value cannot put the screen into a state it cannot show.
      const value = clampUnitMs(ms);
      setSettings((current) => ({ ...current, tapUnitMs: value }));
      void preferences.write(SETTINGS_KEYS.tapUnitMs, String(value));
    },
    [preferences],
  );

  const setPlaybackWpm = useCallback(
    (wpm: number): void => {
      setSettings((current) => ({ ...current, playbackWpm: wpm }));
      void preferences.write(SETTINGS_KEYS.playbackWpm, String(wpm));
    },
    [preferences],
  );

  const setSpeakDecoded = useCallback(
    (on: boolean): void => {
      setSettings((current) => ({ ...current, speakDecoded: on }));
      void preferences.write(SETTINGS_KEYS.speakDecoded, serialiseFlag(on));
    },
    [preferences],
  );

  const setCrashReports = useCallback(
    (on: boolean): void => {
      setSettings((current) => ({ ...current, crashReports: on }));
      void preferences.write(SETTINGS_KEYS.crashReports, serialiseFlag(on));
      // The SDK only reads this at launch, so the switch is a promise about
      // the next run rather than about this one. Told now all the same, so a
      // user who turns it off and force-quits is already opted out.
      void crash.setEnabled(on);
    },
    [crash, preferences],
  );

  const value = useMemo(
    (): SettingsContextValue => ({
      settings,
      ready,
      setTapUnitMs,
      setPlaybackWpm,
      setSpeakDecoded,
      setCrashReports,
    }),
    [settings, ready, setTapUnitMs, setPlaybackWpm, setSpeakDecoded, setCrashReports],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** Reads the user's preferences. Throws outside the provider, as ports do. */
export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (value === null) {
    throw new Error('useSettings must be used inside a SettingsProvider.');
  }
  return value;
}
