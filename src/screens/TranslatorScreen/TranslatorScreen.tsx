import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { MorseText } from '@/components/MorseText';
import { OutputChannels } from '@/components/OutputChannels';
import { SignalButton } from '@/components/SignalButton';
import { SignalSurface } from '@/components/SignalSurface';
import { SegmentedControl, type Segment } from '@/components/SegmentedControl';
import { AppFrame } from '@/components/AppFrame';
import type { TabName } from '@/components/TabBar';
import {
  decode,
  encode,
  encodeToString,
  unsupportedCharacters,
} from '@/core/domain/morse';
import type { AppLocale } from '@/core/domain/locale';
import { useLocale } from '@/application/providers/LocaleProvider';
import { useLayout } from '@/application/useLayout';
import { useSettings } from '@/application/providers/SettingsProvider';
import { useOutputChannels } from '@/application/useOutputChannels';
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

type PaneProps = Readonly<{
  /** True on a tablet, where there is room for a fixed layout. */
  tablet: boolean;
  children: React.ReactNode;
}>;

/**
 * The pair of cards: a scrolling column on a phone, a fixed row on a tablet.
 *
 * The gap goes on `contentContainerStyle` rather than `style`, because a
 * ScrollView's own style sizes the WINDOW and the content container sizes what
 * moves inside it. Styling the window would leave the gap outside the
 * scrollable area, where it does nothing.
 */
function ScrollableCards({ tablet, children }: PaneProps): React.JSX.Element {
  if (tablet) return <View style={styles.columns}>{children}</View>;

  return (
    <ScrollView
      testID="cards-scroll"
      style={styles.cardScroll}
      contentContainerStyle={styles.stack}
      // A tap on a card while the keyboard is up has to reach the card rather
      // than being spent dismissing the keyboard.
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/**
 * The dots and dashes.
 *
 * A tablet's card has a fixed height, so the chips scroll inside it. A phone's
 * cards already scroll, so a second scroll view here would be a trap for the
 * finger — and, with no definite height to flex against, `flex: 1` would
 * resolve to zero and take the chips out of the view hierarchy entirely.
 */
function MorseOutput({ tablet, children }: PaneProps): React.JSX.Element {
  if (!tablet) return <View style={styles.outputScroll}>{children}</View>;

  return (
    <ScrollView
      testID="morse-scroll"
      style={styles.output}
      contentContainerStyle={styles.outputScroll}
    >
      {children}
    </ScrollView>
  );
}

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
  const { playback, cells: channelCells } = useOutputChannels(
    message,
    unitMsForWpm(settings.playbackWpm),
  );
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

  const { tablet } = useLayout();

  const readAloud = useCallback(async (): Promise<void> => {
    await tts.speak(decoded, locale);
  }, [decoded, locale, tts]);

  // The chips are a reading aid; while the screen is carrying the message the
  // square IS the message, and the chips would only compete with it.
  const showSurface = playback.playing && playback.channels.screen;

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
    <AppFrame
      active="translate"
      onSelect={onSelectTab}
      unavailable={unavailableTabs}
      onOpenSettings={onOpenSettings}
    >
      <View
        style={[styles.screen, { paddingTop: insets.top }]}
        testID="translator-screen"
      >
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
            {/* The rail carries the gear on a tablet; two would be one too
                many, and the rail's is the one always in reach. */}
            {tablet ? null : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="open-settings"
                testID="open-settings"
                onPress={onOpenSettings}
                style={styles.iconOnly}
              >
                <Icon
                  name="settings"
                  size={21}
                  color={theme.color.muted}
                  strokeWidth={1.7}
                />
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.body}>
          <SegmentedControl
            testID="direction-toggle"
            segments={segments}
            value={direction}
            onChange={setDirection}
          />

          {/* On a phone the two cards SCROLL. They used to share one fixed
              viewport, and because a Card does not shrink by default while
              `grow` makes this one absorb every shortfall, a few lines of
              typing squeezed the Morse card to nothing: on a 320dp Android
              emulator the dots and dashes were not merely clipped, they left
              the view hierarchy, and `morse-letter` could not be found at all.

              Only the CARDS scroll, not the page. The channel strip and the
              Emit button below them stay where they are, because they are the
              controls — burying Emit under a long message on a small screen
              would trade one defect for a worse one.

              A tablet keeps the fixed layout the artboard draws: two full
              height halves side by side, with the chips scrolling inside their
              own card. There is room there for both to be whole. */}
          <ScrollableCards tablet={tablet}>
            <Card>
              <View style={styles.cardHead}>
                <Text style={styles.label}>
                  {toMorse ? t('translator.sourceLabel') : t('translator.morseLabel')}
                </Text>
                {/* The other two ways of getting text in. Both were drawn on
                    the artboard and neither was ever wired: a tester pressed
                    Speak, watched nothing happen, and reasonably concluded
                    the microphone was broken.

                    They go to the tab that owns that input rather than
                    opening anything here. Speech needs a permission, a live
                    transcript and a recogniser state machine; tapping needs a
                    key, a cut-off and a letter row. Both already exist, one
                    tab away, and a second copy inside this card would be a
                    second thing to keep right. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={toMorse ? 'speak-input' : 'tap-input'}
                  testID={toMorse ? 'speak-input' : 'tap-input'}
                  onPress={() => {
                    onSelectTab?.(toMorse ? 'speak' : 'tap');
                  }}
                  style={({ pressed }) => [styles.textAction, pressed && styles.dimmed]}
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
                // The way OUT of the keyboard. A multiline input defaults to
                // `submitBehavior: 'newline'`, so Return inserts a line break
                // and the only way to dismiss is tapping outside — which, on a
                // phone where this card fills most of the screen, testers
                // could not reliably find. `blurAndSubmit` costs nothing here:
                // the encoder treats a newline as a word break, exactly like
                // the space they would type instead.
                returnKeyType="done"
                submitBehavior="blurAndSubmit"
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
                <MorseOutput tablet={tablet}>
                  <MorseText
                    message={message}
                    selectedIndex={picked}
                    soundingIndex={playback.soundingIndex}
                    onSelectLetter={pickLetter}
                  />
                </MorseOutput>
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
                      <Text style={styles.readAloudLabel}>
                        {t('translator.readAloud')}
                      </Text>
                    </Pressable>
                  ) : null}
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
          </ScrollableCards>

          {/* Outside the scrolling cards, and deliberately.

              It used to sit at the foot of the Morse card. That was fine while
              the card was as tall as the space left over; now the card is as
              tall as its content, and a long message is about fourteen rows of
              chips — so how far along a message was became something you had
              to scroll to find out, while it was playing. The one thing the
              user is waiting on should not be the thing that moves.

              It joins the channel strip and the Emit button in the pinned
              band: what is happening, and what you can do about it, together
              and always in reach. */}
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

          <OutputChannels cells={channelCells} />

          <View style={styles.actions}>
            <SignalButton
              playing={playback.playing}
              canPlay={playback.canPlay}
              onPress={playback.playing ? playback.stop : playback.play}
              label={playback.playing ? t('translator.stop') : t('translator.signal')}
            />
            <IconButton name="copy" label="copy-morse" onPress={() => undefined} />
          </View>
        </View>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.ground },
  // `stack` is what the cards already did; naming it makes the tablet branch a
  // choice between two layouts rather than one layout and an exception.
  // `flexGrow: 1` WITHOUT `flex: 1`, and the difference is the entire fix.
  //
  // This is a ScrollView's content container on a phone. flexGrow lets it
  // stretch to fill the window when the cards are shorter than it, so a short
  // message still looks like the artboard: the Morse card fills the screen.
  // What it does not do is CAP the height at the window. Once the cards need
  // more than that, the container is simply taller and the region scrolls —
  // where the old `flex: 1` had no choice but to take the difference out of
  // the Morse card, and took all of it.
  stack: { flexGrow: 1, gap: theme.spacing.md },
  // The scrolling window itself, which takes what is left between the
  // direction toggle and the channel strip.
  cardScroll: { flex: 1 },
  columns: { flex: 1, flexDirection: 'row', gap: theme.spacing.md },
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
  dimmed: { opacity: 0.6 },
  input: { ...theme.type.input, color: theme.color.ink, padding: 0 },
  monoInput: { ...theme.type.monoLarge, color: theme.color.accent, padding: 0 },
  output: { flex: 1 },
  outputScroll: { paddingBottom: theme.spacing.sm },
  decodedBlock: {
    flex: 1,
    // On a phone the card no longer has a fixed height to fill, so without a
    // floor a one-word translation would collapse this pane onto a single
    // line. Two lines of decoded text and the read-aloud button is the shape
    // the artboard draws.
    minHeight: theme.type.decoded.lineHeight * 2 + 46,
    justifyContent: 'center',
    gap: theme.spacing.xl,
  },
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
});
