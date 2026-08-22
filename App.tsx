import React, { useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { createPorts } from '@/application/createPorts';
import { LocaleProvider } from '@/application/providers/LocaleProvider';
import { PortsProvider } from '@/application/providers/PortsProvider';
import { TorchHost } from '@/components/TorchHost';
import { TranslatorScreen } from '@/screens/TranslatorScreen';
import { theme } from '@/theme';

/**
 * Root. Builds the ports once and injects them; nothing below imports an
 *  `expo-*` package except the adapters themselves.
 */
export default function App(): React.JSX.Element {
  const { ports, torch } = useMemo(() => createPorts(), []);

  return (
    <SafeAreaProvider>
      <PortsProvider ports={ports}>
        <LocaleProvider>
          <SafeAreaView style={styles.root}>
            <StatusBar style="dark" />
            <TranslatorScreen />
            <TorchHost adapter={torch} />
          </SafeAreaView>
        </LocaleProvider>
      </PortsProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.ground },
});
