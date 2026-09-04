import React, { useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { createPorts } from '@/application/createPorts';
import type { TorchAdapter } from '@/adapters/torch/expoTorchAdapter';
import { LocaleProvider } from '@/application/providers/LocaleProvider';
import { PortsProvider } from '@/application/providers/PortsProvider';
import { TorchHost } from '@/components/TorchHost';
import type { TabName } from '@/components/TabBar';
import { FirstRunScreen } from '@/screens/FirstRunScreen';
import { LearnScreen } from '@/screens/LearnScreen';
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
          <Shell torch={torch} />
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
 * Empty now that Learn exists — every tab goes somewhere. Kept rather than
 * deleted because Settings, Language, Tips and the permission gates are still
 * unbuilt, and the next thing that needs a placeholder will want it back.
 */
const UNBUILT: readonly TabName[] = [];

function Shell({ torch }: Readonly<{ torch: TorchAdapter }>): React.JSX.Element {
  const firstRun = useFirstRun();
  const [tab, setTab] = useState<TabName>('translate');

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

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {tab === 'speak' ? (
        <SpeechScreen onSelectTab={setTab} unavailableTabs={UNBUILT} />
      ) : tab === 'tap' ? (
        <TapScreen onSelectTab={setTab} unavailableTabs={UNBUILT} />
      ) : tab === 'learn' ? (
        <LearnScreen onSelectTab={setTab} unavailableTabs={UNBUILT} />
      ) : (
        <TranslatorScreen onSelectTab={setTab} unavailableTabs={UNBUILT} />
      )}
      {/* Outside the screens: the torch keeps burning across a tab change, and
          a host that unmounted with the screen would drop it mid-message. */}
      <TorchHost adapter={torch} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.ground },
});
