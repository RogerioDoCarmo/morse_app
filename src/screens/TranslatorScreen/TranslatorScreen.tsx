import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { MorseText } from '@/components/MorseText';
import { OutputChannels, type ChannelCell } from '@/components/OutputChannels';
import { SignalSurface } from '@/components/SignalSurface';
import { SegmentedControl, type Segment } from '@/components/SegmentedControl';
import { TabBar, type TabName } from '@/components/TabBar';
import {
  decode,
  encode,
  encodeToString,
  unsupportedCharacters,
} from '@/core/domain/morse';
import type { AppLocale } from '@/core/domain/locale';
import { useLocale } from '@/application/providers/LocaleProvider';
import { useSettings } from '@/application/providers/SettingsProvider';
import { useMorsePlayback } from '@/application/useMorsePlayback';
import { usePorts } from '@/application/providers/PortsProvider';
import { unitMsForWpm } from '@/core/domain/timeline';
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

/** `m:ss`, the way a player shows a position. */
function clock(ms: number): string {
  const seconds = Math.round(ms / 1000);
  const rest = seconds % 60;
  return `${String(Math.floor(seconds / 60))}:${rest < 10 ? '0' : ''}${String(rest)}`;
}

/** Both optional so the screen can still be rendered on its own in a test. */
type Props = Readonly<{
  onSelectTab?: ((tab: TabName) => void) | undefined;
  unavailableTabs?: readonly TabName[] | undefined;
  onOpenSettings?: (() => void) | undefined;
}>;

/**
 * The Translator screen — built from `design/screens/Main.dc.html`.
 *
 * The artboard is HTML and does not compile; every value here was transcribed
 * from it, and the repeated chrome (cards, the segmented control, the tab bar)
 * is extracted into components rather than copied per screen the way the
 * artboards necessarily do.
 */
export function TranslatorScreen({
  onSelectTab,
  unavailableTabs,
  onOpenSettings,
}: Props = {}): React.JSX.Element {
  const { t, locale } = useLocale();
  const { tts } = usePorts();
  const insets = useSafeAreaInsets();

  // Seeded from the locale so the sample never contradicts the label above it,
  // and the Morse seed is derived rather than written out — the two directions
  // cannot drift apart that way.
  const sample = t('translator.sample');
  const [direction, setDirection] = useState<Direction>('toMorse');
  const [text, setText] = useState(sample);
  const [morseInput, setMorseInput] = useState(() => encodeToString(sample));
  const [picked, setPicked] = useState<number | null>(null);

  const toMorse = direction === 'toMorse';
  const decoded = useMemo(() => decode(morseInput), [morseInput]);
  const source = toMorse ? text : decoded;
  const message = useMemo(() => encode(source), [source]);
  const morse = useMemo(() => encodeToString(source), [source]);
  // What the encoder will throw away. Dropping it is right — there is no code
  // to send — but dropping it without saying so leaves the sender believing a
  // message went out whole.
  const unsupported = useMemo(() => unsupportedCharacters(source), [source]);
  // Playback speed is a saved preference; the hook wants a dot length.
  const { settings } = useSettings();
  const playback = useMorsePlayback(message, unitMsForWpm(settings.playbackWpm));
  // One decimal is enough to look continuous and keeps the style object stable.
  const progressPercent = Math.round(playback.progress * 1000) / 10;

  const segments: readonly Segment<Direction>[] = [
    { value: 'toMorse', label: t('translator.toMorse') },
    { value: 'toText', label: t('translator.toText') },
  ];

  // The card has always said "tap a letter to hear it". This is what makes
  // that true; selecting without playing left the hint promising something the
  // screen did not do.
  const pickLetter = useCallback(
    (index: number): void => {
      // Nothing at all while a message is running: not the sound, and not the
      // selection either. The highlight belongs to the playhead then, and
      // moving it under a running message would fight with it.
      if (playback.playing) return;

      setPicked(index);
      playback.playLetter(index);
    },
    [playback],
  );

  const readAloud = useCallback(async (): Promise<void> => {
    await tts.speak(decoded, locale);
  }, [decoded, locale, tts]);

  // The chips are a reading aid; while the screen is carrying the message the
  // square IS the message, and the chips would only compete with it.
  const showSurface = playback.playing && playback.channels.screen;

  const channelCells: readonly ChannelCell[] = [
    {
      channel: 'sound',
      icon: 'volume',
      label: t('translator.channelSound'),
      on: playback.channels.sound,
      onToggle: () => {
        playback.toggleChannel('sound');
      },
    },
    {
      channel: 'light',
      icon: 'zap',
      label: t('translator.channelLight'),
      on: playback.channels.light,
      onToggle: () => {
        playback.toggleChannel('light');
      },
    },
    {
      channel: 'screen',
      icon: 'screen',
      label: t('translator.channelScreen'),
      on: playback.channels.screen,
      onToggle: () => {
        playback.toggleChannel('screen');
      },
    },
    {
      channel: 'buzz',
      icon: 'vibrate',
      label: t('translator.channelBuzz'),
      on: playback.channels.buzz,
      onToggle: () => {
        playback.toggleChannel('buzz');
      },
    },
  ];

  // One slot, three things it can say — and they rank. What is happening now
  // beats a warning, and a warning beats a standing hint.
  const headerNote = playback.playing ? (
    <View style={styles.playingBadge} testID="playing-badge">
      <Icon name="volume" size={13} color={theme.color.accent} strokeWidth={2.2} />
      <Text style={styles.playingLabel}>{t('translator.playing')}</Text>
    </View>
  ) : unsupported.length > 0 ? (
    <Text style={styles.unsupported} numberOfLines={2} testID="unsupported-notice">
      {t('translator.unsupported', { chars: unsupported.join(' ') })}
    </Text>
  ) : (
    <Text style={styles.hint} numberOfLines={2}>
      {t('translator.hint')}
    </Text>
  );

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
            onPress={onOpenSettings}
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
            {toMorse ? headerNote : null}
          </View>

          {toMorse && showSurface ? (
            <SignalSurface lit={playback.screenLit} />
          ) : toMorse ? (
            <ScrollView style={styles.output} contentContainerStyle={styles.outputScroll}>
              <MorseText
                message={message}
                selectedIndex={picked}
                soundingIndex={playback.soundingIndex}
                onSelectLetter={pickLetter}
              />
            </ScrollView>
          ) : (
            <View style={styles.decodedBlock}>
              <Text testID="decoded-text" style={styles.decoded}>
                {decoded}
              </Text>
              {/* Offered only when the setting is on. Speaking is the one
                  output here that carries the message in words rather than in
                  code, so it is the one a user may not want at all. */}
              {settings.speakDecoded ? (
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
              ) : null}
            </View>
          )}

          <View style={styles.monoFooter}>
            {playback.playing ? (
              <View style={styles.progressRow} testID="playback-progress">
                <View style={styles.track}>
                  <View
                    testID="playback-fill"
                    style={[styles.trackFill, { width: `${progressPercent}%` }]}
                  />
                </View>
                <Text testID="playback-clock" style={styles.clock}>
                  {clock(playback.elapsedMs)} / {clock(playback.durationMs)}
                </Text>
              </View>
            ) : null}
            <Text
              testID="morse-string"
              accessibilityLabel="morse-string"
              style={styles.mono}
            >
              {morse}
            </Text>
          </View>
        </Card>

        <OutputChannels cells={channelCells} />

        <View style={styles.actions}>
          <Pressable
            testID="signal-button"
            accessibilityRole="button"
            accessibilityLabel="signal-button"
            accessibilityState={{
              selected: playback.playing,
              disabled: !playback.playing && !playback.canPlay,
            }}
            disabled={!playback.playing && !playback.canPlay}
            onPress={playback.playing ? playback.stop : playback.play}
            style={({ pressed }) => [
              styles.signal,
              playback.playing && styles.signalPlaying,
              !playback.playing && !playback.canPlay && styles.signalBlocked,
              pressed && styles.signalPressed,
            ]}
          >
            <Icon
              name={playback.playing ? 'stop' : 'play'}
              size={17}
              color={
                !playback.playing && !playback.canPlay
                  ? theme.color.faint
                  : theme.color.onInk
              }
            />
            <Text
              style={[
                styles.signalLabel,
                !playback.playing && !playback.canPlay && styles.signalLabelBlocked,
              ]}
            >
              {playback.playing ? t('translator.stop') : t('translator.signal')}
            </Text>
          </Pressable>
          <IconButton name="copy" label="copy-morse" onPress={() => undefined} />
        </View>
      </View>

      <TabBar active="translate" onSelect={onSelectTab} unavailable={unavailableTabs} />
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
  output: { flex: 1 },
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
    gap: 11,
  },
  playingBadge: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  // Ink rather than the faint hint colour it replaces: this is the one thing in
  // the row the user has to notice.
  unsupported: {
    ...theme.type.label,
    color: theme.color.ink,
    flexShrink: 1,
    textAlign: 'right',
  },
  playingLabel: { ...theme.type.label, color: theme.color.accent },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  track: {
    flex: 1,
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.track,
    overflow: 'hidden',
  },
  trackFill: {
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.accent,
  },
  clock: { ...theme.type.mono, color: theme.color.muted, flexShrink: 0 },
  mono: { ...theme.type.mono, color: theme.color.muted },
  actions: { flexDirection: 'row', gap: 10, paddingBottom: theme.spacing.md },
  signal: {
    flex: 1,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: theme.radius.chip,
    backgroundColor: theme.color.ink,
  },
  signalPlaying: { backgroundColor: theme.color.accent },
  // Nothing switched on: there is nothing for it to drive, and saying so is
  // better than animating a progress bar over silence.
  signalBlocked: { backgroundColor: theme.color.track },
  signalPressed: { opacity: 0.85 },
  signalLabel: { ...theme.type.action, color: theme.color.onInk },
  signalLabelBlocked: { color: theme.color.faint },
});
