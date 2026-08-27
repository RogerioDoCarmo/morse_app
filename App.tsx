import React, { useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { createPorts } from '@/application/createPorts';
import { LocaleProvider } from '@/application/providers/LocaleProvider';
import { PortsProvider } from '@/application/providers/PortsProvider';
import { TorchHost } from '@/components/TorchHost';
import { TranslatorScreen } from '@/screens/TranslatorScreen';
import { useAppFonts } from '@/adapters/fonts/expoFontsAdapter';
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
          <View style={styles.root}>
            <StatusBar style="dark" />
            <TranslatorScreen />
            <TorchHost adapter={torch} />
          </View>
        </LocaleProvider>
      </PortsProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.ground },
});
