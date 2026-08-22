import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { MorseText } from '@/components/MorseText';
import { SegmentedControl, type Segment } from '@/components/SegmentedControl';
import { TabBar } from '@/components/TabBar';
import { decode, encode, encodeToString } from '@/core/domain/morse';
import type { AppLocale } from '@/core/domain/locale';
import { useLocale } from '@/application/providers/LocaleProvider';
import { usePorts } from '@/application/providers/PortsProvider';
import { theme } from '@/theme';

/**
 * The two-letter badge in the header. Derived, not translated — it would read
 * the same in all three locales.
 */
function localeBadge(locale: AppLocale): string {
  return locale === 'pt-BR' ? 'PT' : locale.toUpperCase();
}

/** Which way the translation runs. */
type Direction = 'toMorse' | 'toText';

const SAMPLE_TEXT = 'Hello world';
const SAMPLE_MORSE = '.... . .-.. .-.. ---   .-- --- .-. .-.. -..';

/**
 * The Translator screen — built from `design/screens/Main.dc.html`.
 *
 * The artboard is HTML and does not compile; every value here was transcribed
 * from it, and the repeated chrome (cards, the segmented control, the tab bar)
 * is extracted into components rather than copied per screen the way the
 * artboards necessarily do.
 */
export function TranslatorScreen(): React.JSX.Element {
  const { t, locale } = useLocale();
  const { torch, tts } = usePorts();
  const insets = useSafeAreaInsets();

  const [direction, setDirection] = useState<Direction>('toMorse');
  const [text, setText] = useState(SAMPLE_TEXT);
  const [morseInput, setMorseInput] = useState(SAMPLE_MORSE);
  const [picked, setPicked] = useState<number | null>(null);
  const [flashing, setFlashing] = useState(false);

  const toMorse = direction === 'toMorse';
  const decoded = useMemo(() => decode(morseInput), [morseInput]);
  const source = toMorse ? text : decoded;
  const message = useMemo(() => encode(source), [source]);
  const morse = useMemo(() => encodeToString(source), [source]);

  const segments: readonly Segment<Direction>[] = [
    { value: 'toMorse', label: t('translator.toMorse') },
    { value: 'toText', label: t('translator.toText') },
  ];

  const toggleFlash = useCallback(async (): Promise<void> => {
    const next = !flashing;
    setFlashing(next);
    await torch.setEnabled(next);
  }, [flashing, torch]);

  const readAloud = useCallback(async (): Promise<void> => {
    await tts.speak(decoded, locale);
  }, [decoded, locale, tts]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="translator-screen">
      <View style={styles.header}>
        <Text style={styles.wordmark}>{t('app.name')}</Text>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="locale-picker"
            testID="locale-picker"
            style={styles.localeButton}
          >
            <Text style={styles.localeText}>{localeBadge(locale)}</Text>
            <Icon
              name="chevronDown"
              size={13}
              color={theme.color.muted}
              strokeWidth={2.4}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="open-settings"
            testID="open-settings"
            style={styles.iconOnly}
          >
            <Icon name="settings" size={21} color={theme.color.muted} strokeWidth={1.7} />
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        <SegmentedControl
          testID="direction-toggle"
          segments={segments}
          value={direction}
          onChange={setDirection}
        />

        <Card>
          <View style={styles.cardHead}>
            <Text style={styles.label}>
              {toMorse ? t('translator.sourceLabel') : t('translator.morseLabel')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={toMorse ? 'speak-input' : 'tap-input'}
              testID={toMorse ? 'speak-input' : 'tap-input'}
              style={styles.textAction}
            >
              <Icon
                name={toMorse ? 'mic' : 'tap'}
                size={15}
                color={theme.color.accent}
                strokeWidth={2.1}
              />
              <Text style={styles.textActionLabel}>
                {toMorse ? t('translator.speak') : t('translator.tapItIn')}
              </Text>
            </Pressable>
          </View>
          <TextInput
            testID="translator-input"
            accessibilityLabel="translator-input"
            style={toMorse ? styles.input : styles.monoInput}
            value={toMorse ? text : morseInput}
            onChangeText={toMorse ? setText : setMorseInput}
            multiline
            placeholderTextColor={theme.color.faint}
          />
        </Card>

        <Card grow testID="morse-card">
          <View style={styles.cardHead}>
            <Text style={styles.label}>
              {toMorse ? t('translator.morseLabel') : t('translator.sourceLabel')}
            </Text>
            {toMorse ? (
              <Text style={styles.hint} numberOfLines={2}>
                {t('translator.hint')}
              </Text>
            ) : null}
          </View>

          {toMorse ? (
            <ScrollView contentContainerStyle={styles.outputScroll}>
              <MorseText
                message={message}
                selectedIndex={picked}
                onSelectLetter={setPicked}
              />
            </ScrollView>
          ) : (
            <View style={styles.decodedBlock}>
              <Text testID="decoded-text" style={styles.decoded}>
                {decoded}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="read-aloud"
                testID="read-aloud"
                onPress={() => {
                  void readAloud();
                }}
                style={styles.readAloud}
              >
                <Icon
                  name="volume"
                  size={17}
                  color={theme.color.accentDeep}
                  strokeWidth={2}
                />
                <Text style={styles.readAloudLabel}>{t('translator.readAloud')}</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.monoFooter}>
            <Text
              testID="morse-string"
              accessibilityLabel="morse-string"
              style={styles.mono}
            >
              {morse}
            </Text>
          </View>
        </Card>

        <View style={styles.actions}>
          <Pressable
            testID="flash-button"
            accessibilityRole="button"
            accessibilityLabel="flash-button"
            accessibilityState={{ selected: flashing }}
            onPress={() => {
              void toggleFlash();
            }}
            style={({ pressed }) => [styles.flash, pressed && styles.flashPressed]}
          >
            <Icon name="zap" size={18} color={theme.color.onInk} />
            <Text style={styles.flashLabel}>{t('translator.flash')}</Text>
          </Pressable>
          <IconButton name="volume" label="play-audio" onPress={() => undefined} />
          <IconButton name="copy" label="copy-morse" onPress={() => undefined} />
        </View>
      </View>

      <TabBar active="translate" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.ground },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.gutter,
  },
  wordmark: { ...theme.type.wordmark, color: theme.color.ink },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  localeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: theme.hitTarget,
    paddingHorizontal: theme.spacing.md,
  },
  localeText: { ...theme.type.chip, color: theme.color.muted },
  iconOnly: {
    width: theme.hitTarget,
    height: theme.hitTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
  },
  body: {
    flex: 1,
    paddingHorizontal: theme.gutter,
    paddingTop: 10,
    gap: theme.spacing.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    marginBottom: 10,
  },
  label: { ...theme.type.label, color: theme.color.faint, flexShrink: 0 },
  // The hint must shrink and wrap: it fits beside the label in English at 390pt
  // and collides at 360pt in Portuguese. Same fix as the artboard.
  hint: {
    ...theme.type.hint,
    color: theme.color.faint,
    flexShrink: 1,
    textAlign: 'right',
  },
  textAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: theme.hitTarget,
    paddingHorizontal: theme.spacing.md,
    marginVertical: -6,
    marginRight: -6,
  },
  textActionLabel: { ...theme.type.chip, color: theme.color.accent },
  input: { ...theme.type.input, color: theme.color.ink, padding: 0 },
  monoInput: { ...theme.type.monoLarge, color: theme.color.accent, padding: 0 },
  outputScroll: { paddingBottom: theme.spacing.sm },
  decodedBlock: { flex: 1, justifyContent: 'center', gap: theme.spacing.xl },
  decoded: { ...theme.type.decoded, color: theme.color.ink },
  readAloud: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 46,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.accentTint,
  },
  readAloudLabel: { ...theme.type.control, color: theme.color.accentDeep },
  monoFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.border,
    paddingTop: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  mono: { ...theme.type.mono, color: theme.color.muted },
  actions: { flexDirection: 'row', gap: 10, paddingBottom: theme.spacing.md },
  flash: {
    flex: 1,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: theme.radius.chip,
    backgroundColor: theme.color.ink,
  },
  flashPressed: { opacity: 0.85 },
  flashLabel: { ...theme.type.action, color: theme.color.onInk },
});
