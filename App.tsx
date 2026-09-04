import React, { useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { createPorts } from '@/application/createPorts';
import type { TorchAdapter } from '@/adapters/torch/expoTorchAdapter';
import { LocaleProvider } from '@/application/providers/LocaleProvider';
import { PortsProvider } from '@/application/providers/PortsProvider';
import { TorchHost } from '@/components/TorchHost';
import { FirstRunScreen } from '@/screens/FirstRunScreen';
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
function Shell({ torch }: Readonly<{ torch: TorchAdapter }>): React.JSX.Element {
  const firstRun = useFirstRun();

  // Nothing at all until the stored answer is in: showing the Translator for a
  // frame and then covering it is worse than a beat of empty ground.
  if (!firstRun.ready) {
    return <View style={styles.root} testID="app-loading" />;
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {firstRun.show ? (
        <FirstRunScreen onDone={firstRun.dismiss} />
      ) : (
        <>
          <TranslatorScreen />
          <TorchHost adapter={torch} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.ground },
});
