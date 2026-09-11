import React, { useCallback, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { createPorts } from '@/application/createPorts';
import type { TorchAdapter } from '@/adapters/torch/expoTorchAdapter';
import { LocaleProvider } from '@/application/providers/LocaleProvider';
import { PermissionGate } from '@/application/providers/PermissionGate';
import { PortsProvider } from '@/application/providers/PortsProvider';
import { SettingsProvider } from '@/application/providers/SettingsProvider';
import { TorchHost } from '@/components/TorchHost';
import type { TabName } from '@/components/TabBar';
import { FirstRunScreen } from '@/screens/FirstRunScreen';
import { LearnScreen } from '@/screens/LearnScreen';
import { LanguageScreen } from '@/screens/LanguageScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { SpeechScreen } from '@/screens/SpeechScreen';
import { TapScreen } from '@/screens/TapScreen';
import { TranslatorScreen } from '@/screens/TranslatorScreen';
import { useAppFonts } from '@/adapters/fonts/expoFontsAdapter';
import { useFirstRun } from '@/application/useFirstRun';
import { theme } from '@/theme';

/**
 * Root. Builds the ports once and injects them; nothing below imports an
 *  `expo-*` package except the adapters themselves.
 */
export default function App(): React.JSX.Element {
  const { ports, torch } = useMemo(() => createPorts(), []);
  const fontsLoaded = useAppFonts();

  // Painting text in the system font first and reflowing when the real family
  // lands is worse than a beat of empty ground.
  if (!fontsLoaded) {
    return <View style={styles.root} testID="app-loading" />;
  }

  return (
    <SafeAreaProvider>
      <PortsProvider ports={ports}>
        <LocaleProvider>
          <SettingsProvider>
            <PermissionGate>
              <Shell torch={torch} />
            </PermissionGate>
          </SettingsProvider>
        </LocaleProvider>
      </PortsProvider>
    </SafeAreaProvider>
  );
}

/**
 * Inside the providers, because the first-run gate reads through a port.
 *
 * The guide REPLACES the Translator rather than covering it. A carousel over
 * a live screen invites taps at what is behind it, and the Translator would
 * be holding a torch and a clock it cannot be seen to control.
 */
/**
 * Destinations the tab bar shows but cannot reach yet.
 *
 * Empty, and every screen the tab bar can reach now exists. Kept rather than
 * deleted because the tablet layouts are still unbuilt, and the next thing
 * that needs a placeholder will want it back.
 */
const UNBUILT: readonly TabName[] = [];

function Shell({ torch }: Readonly<{ torch: TorchAdapter }>): React.JSX.Element {
  const firstRun = useFirstRun();
  const [tab, setTab] = useState<TabName>('translate');
  /**
   * Whether the user has been anywhere yet.
   *
   * The Translator focuses its input on OPEN, and only on open. `autoFocus`
   * fires on every mount and this shell unmounts a screen when the tab
   * changes, so without this every return to Translate raised the keyboard
   * over the tab bar that had just been tapped.
   */
  // Settings is not a tab — it opens over whichever one you were on, and the
  // back arrow returns you there rather than to a fixed home.
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Language sits on top of Settings rather than replacing it: its back arrow
  // returns to the rows that led there.
  const [languageOpen, setLanguageOpen] = useState(false);

  const goToTab = useCallback((next: TabName): void => {
    setTab(next);
  }, []);

  const openSettings = useCallback((): void => {
    setSettingsOpen(true);
  }, []);
  // Nothing at all until the stored answer is in: showing the Translator for a
  // frame and then covering it is worse than a beat of empty ground.
  if (!firstRun.ready) {
    return <View style={styles.root} testID="app-loading" />;
  }

  if (firstRun.show) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <FirstRunScreen onDone={firstRun.dismiss} />
      </View>
    );
  }

  if (settingsOpen && languageOpen) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <TorchHost adapter={torch} />
        <LanguageScreen
          onBack={() => {
            setLanguageOpen(false);
          }}
        />
      </View>
    );
  }

  if (settingsOpen) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <TorchHost adapter={torch} />
        <SettingsScreen
          onBack={() => {
            setSettingsOpen(false);
          }}
          onOpenLearn={() => {
            setSettingsOpen(false);
            goToTab('learn');
          }}
          onOpenLanguage={() => {
            setLanguageOpen(true);
          }}
          // Settings stays open underneath: the guide was opened from here,
          // so this is where dismissing it should land.
          onShowGuide={firstRun.replay}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {/* FIRST, so every screen paints over it.

          It is a camera preview, and a camera preview on Android is a
          SurfaceView drawing to its own hardware layer — it ignores a parent's
          opacity, which is how the first version of this ended up flashing a
          black rectangle across half a Poco X5 5G. It is positioned off screen
          as well, but ordering it behind the opaque screens costs nothing and
          covers the case where the surface does not stay where the view is.

          Outside the screens, because the torch keeps burning across a tab
          change and a host that unmounted with the screen would drop it
          mid-message. */}
      <TorchHost adapter={torch} />
      {tab === 'speak' ? (
        <SpeechScreen onSelectTab={goToTab} unavailableTabs={UNBUILT} />
      ) : tab === 'tap' ? (
        <TapScreen onSelectTab={goToTab} unavailableTabs={UNBUILT} />
      ) : tab === 'learn' ? (
        <LearnScreen onSelectTab={goToTab} unavailableTabs={UNBUILT} />
      ) : (
        <TranslatorScreen
          onSelectTab={goToTab}
          unavailableTabs={UNBUILT}
          onOpenSettings={openSettings}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.ground },
});
