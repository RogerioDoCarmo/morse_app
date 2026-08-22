import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MorseText } from '@/components/MorseText';
import { encode, encodeToString } from '@/core/domain/morse';
import { useLocale } from '@/application/providers/LocaleProvider';
import { usePorts } from '@/application/providers/PortsProvider';
import { theme } from '@/theme';

/**
 * The Translator screen, text → Morse.
 *
 * A deliberately thin slice: it proves the layering end to end — a screen reads
 * pure domain functions for the encoding and reaches hardware only through
 * injected ports. The full design (mode toggle, tap decode, flash playback)
 * lands in the feature branch.
 */
export function TranslatorScreen(): React.JSX.Element {
  const { t } = useLocale();
  const { torch } = usePorts();
  const [text, setText] = useState('Hello world');
  const [flashing, setFlashing] = useState(false);

  const message = useMemo(() => encode(text), [text]);
  const morse = useMemo(() => encodeToString(text), [text]);

  const toggleFlash = async (): Promise<void> => {
    const next = !flashing;
    setFlashing(next);
    await torch.setEnabled(next);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="translator-screen"
    >
      <Text style={styles.title}>{t('app.name')}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>{t('translator.sourceLabel')}</Text>
        <TextInput
          testID="translator-input"
          accessibilityLabel="translator-input"
          style={styles.input}
          value={text}
          onChangeText={setText}
          multiline
          placeholder={t('translator.toMorse')}
          placeholderTextColor={theme.color.faint}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t('translator.morseLabel')}</Text>
        <MorseText message={message} />
        <Text testID="morse-string" accessibilityLabel="morse-string" style={styles.mono}>
          {morse}
        </Text>
      </View>

      <Pressable
        testID="flash-button"
        accessibilityLabel="flash-button"
        accessibilityRole="button"
        accessibilityState={{ selected: flashing }}
        style={styles.flash}
        onPress={() => {
          void toggleFlash();
        }}
      >
        <Text style={styles.flashLabel}>{t('translator.flash')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.ground },
  content: { padding: 20, gap: theme.spacing.md },
  title: { fontSize: 22, fontWeight: '800', color: theme.color.ink },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  label: { fontSize: 12, fontWeight: '700', color: theme.color.faint },
  input: { fontSize: 24, color: theme.color.ink, minHeight: theme.hitTarget },
  mono: { fontSize: 12, color: theme.color.muted },
  flash: {
    minHeight: 54,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashLabel: { color: theme.color.surface, fontSize: 15, fontWeight: '700' },
});
