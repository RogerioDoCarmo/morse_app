import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@/application/providers/LocaleProvider';
import type { IconName } from '@/components/Icon';
import { MorseText } from '@/components/MorseText';
import { OutputChannels, type ChannelCell } from '@/components/OutputChannels';
import { encode } from '@/core/domain/morse';
import type { TranslationKey } from '@/i18n';
import { theme } from '@/theme';

/** Which illustration a slide carries. */
type Illustration = 'chips' | 'channels' | 'letter';

type Slide = Readonly<{
  title: TranslationKey;
  body: TranslationKey;
  show: Illustration;
}>;

const SLIDES: readonly Slide[] = [
  { title: 'firstRun.oneTitle', body: 'firstRun.oneBody', show: 'chips' },
  { title: 'firstRun.twoTitle', body: 'firstRun.twoBody', show: 'channels' },
  { title: 'firstRun.threeTitle', body: 'firstRun.threeBody', show: 'letter' },
];

/**
 * The channel strip exactly as the Translator will show it on first run:
 * sound on, everything else off. Inert here — this is a picture of the control,
 * not the control.
 */
function strip(label: (key: TranslationKey) => string): readonly ChannelCell[] {
  const cells: readonly [ChannelCell['channel'], IconName, TranslationKey, boolean][] = [
    ['sound', 'volume', 'translator.channelSound', true],
    ['light', 'zap', 'translator.channelLight', false],
    ['screen', 'screen', 'translator.channelScreen', false],
    ['buzz', 'vibrate', 'translator.channelBuzz', false],
  ];
  return cells.map(([channel, icon, key, on]) => ({
    channel,
    icon,
    label: label(key),
    on,
  }));
}

type Props = Readonly<{
  /** Called once, when the guide is done with. */
  onDone: () => void;
}>;

/**
 * The first-run guide.
 *
 * It exists because the Light channel starts off: without it the torch is a
 * feature nobody finds and the output strip looks like decoration.
 *
 * The illustrations are the app's own components rather than artwork, so the
 * guide cannot promise something the next screen does not show.
 */
export function FirstRunScreen({ onDone }: Props): React.JSX.Element {
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);

  // The Translator seeds its input in the interface language, so the guide's
  // illustration has to as well — an English sample inside a Spanish screen
  // reads as a bug, not as a picture of Morse.
  const sample = t('translator.sample');
  const sampleMessage = useMemo(() => encode(sample), [sample]);
  const oneLetter = useMemo(() => encode(sample.slice(0, 3)), [sample]);

  const slide = SLIDES[index] ?? SLIDES[0];
  const last = index === SLIDES.length - 1;

  return (
    <View
      testID="first-run"
      style={[
        styles.screen,
        { paddingTop: insets.top, paddingBottom: insets.bottom + 20 },
      ]}
    >
      <View style={styles.top}>
        {last ? null : (
          <Pressable
            testID="first-run-skip"
            accessibilityRole="button"
            accessibilityLabel="first-run-skip"
            // Skips to the last slide rather than dismissing: Start stays the
            // single way out, so nobody leaves by a door they did not mean.
            onPress={() => {
              setIndex(SLIDES.length - 1);
            }}
            style={styles.skip}
          >
            <Text style={styles.skipLabel}>{t('firstRun.skip')}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.stage} testID={`first-run-art-${slide?.show ?? 'chips'}`}>
        {slide?.show === 'chips' ? (
          <View style={styles.card}>
            <Text style={styles.sample}>{sample}</Text>
            <MorseText message={sampleMessage} testID="first-run-chips" />
          </View>
        ) : null}

        {slide?.show === 'channels' ? <OutputChannels cells={strip(t)} /> : null}

        {slide?.show === 'letter' ? (
          <View style={styles.card}>
            <MorseText message={oneLetter} selectedIndex={1} testID="first-run-letter" />
          </View>
        ) : null}
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>{t(slide?.title ?? 'firstRun.oneTitle')}</Text>
        <Text style={styles.body}>{t(slide?.body ?? 'firstRun.oneBody')}</Text>
      </View>

      <View style={styles.dots} testID="first-run-dots">
        {SLIDES.map((each, dot) => (
          <View
            key={each.title}
            style={[styles.dot, dot === index && styles.dotOn]}
            testID={dot === index ? 'first-run-dot-on' : 'first-run-dot'}
          />
        ))}
      </View>

      <Pressable
        testID="first-run-next"
        accessibilityRole="button"
        accessibilityLabel="first-run-next"
        onPress={() => {
          if (last) onDone();
          else setIndex(index + 1);
        }}
        style={({ pressed }) => [styles.next, pressed && styles.pressed]}
      >
        <Text style={styles.nextLabel}>
          {last ? t('firstRun.start') : t('firstRun.next')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.ground },
  top: {
    height: 48,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing.md,
  },
  skip: {
    height: theme.hitTarget,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  skipLabel: { ...theme.type.body, color: theme.color.muted },
  stage: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.gutter,
  },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.card,
    padding: 22,
    gap: theme.spacing.lg,
    boxShadow: theme.shadow.card,
  },
  sample: { ...theme.type.input, color: theme.color.ink },
  copy: { paddingHorizontal: theme.spacing.xl, gap: 10 },
  title: { ...theme.type.title, color: theme.color.ink },
  body: { ...theme.type.body, fontSize: 15, lineHeight: 22.5, color: theme.color.muted },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 18,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: '#d3d8de',
  },
  dotOn: { width: 22, backgroundColor: theme.color.accent },
  next: {
    height: 54,
    marginHorizontal: theme.gutter,
    borderRadius: theme.radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.ink,
  },
  pressed: { opacity: 0.85 },
  nextLabel: { ...theme.type.action, color: theme.color.onInk },
});
