import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { MorseText } from '@/components/MorseText';
import { OutputChannels } from '@/components/OutputChannels';
import { SignalButton } from '@/components/SignalButton';
import { SignalSurface } from '@/components/SignalSurface';
import { Toast } from '@/components/Toast';
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
function ScrollableCards({
  tablet,
  children,
  scrollRef,
}: PaneProps & { scrollRef?: React.RefObject<ScrollView | null> }): React.JSX.Element {
  if (tablet) return <View style={styles.columns}>{children}</View>;

  return (
    <ScrollView
      ref={scrollRef}
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
function MorseOutput({
  tablet,
  children,
  scrollRef,
}: PaneProps & { scrollRef?: React.RefObject<ScrollView | null> }): React.JSX.Element {
  if (!tablet) return <View style={styles.outputScroll}>{children}</View>;

  return (
    <ScrollView
      ref={scrollRef}
      testID="morse-scroll"
      style={styles.output}
      contentContainerStyle={styles.outputScroll}
    >
      {children}
    </ScrollView>
  );
}

/**
 * How long the copy button shows a tick before turning back into a copy icon.
 *
 * Long enough to be seen if you glanced away, short enough that the button is
 * itself again before you would reach for it a second time.
 *
 * ⚠️ 1.8s was the first value and it was too tight to OBSERVE. A single
 * Maestro assertion on a software-rendered emulator can take longer than that,
 * so the tick had reverted before the flow could look at it — a state that
 * exists but cannot be checked is one nobody can defend against a regression.
 * 2.5s reads the same to a person and leaves the test somewhere to stand.
 */
const COPIED_ICON_MS = 2500;

/**
 * How much room to leave above the letter being chased.
 *
 * Scrolling it to the very top would put every letter that comes next off
 * screen, which is the opposite of the point: the interesting thing about a
 * playhead is what it is about to reach.
 */
const FOLLOW_MARGIN = 120;

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
  const { clipboard } = usePorts();

  // ⚠️ "Untouched", not "empty". The field is SEEDED with SOS, so emptiness
  // would never be true on open and the dot would never show; and clearing the
  // field later is not a reason to start pointing at it again.
  const [touchedInput, setTouchedInput] = useState(false);
  /**
   * ⚠️ TWO states, not one, and they have different lifetimes on purpose.
   *
   * The tick is a fast acknowledgement at the fingertip and reverts itself
   * after COPIED_ICON_MS. The toast is the explicit message and lives the
   * Toast component's own LINGER_MS, or until the user taps it away.
   *
   * They shared one `copied` flag at first. The icon's 1.8s timer then cleared
   * the toast as well, so the toast was gone in under two seconds instead of
   * six — and the E2E flow failed asserting it, on a slow emulator, in the gap
   * between checking the icon and checking the toast. The comment above the
   * handler already described two lifetimes; the code had one.
   */
  /**
   * The scroll view that actually scrolls, which differs by layout.
   *
   * ⚠️ On a phone the chips are NOT in their own scroll view — the cards
   * scroll and the chips ride along inside them. On a tablet the card has a
   * fixed height and the chips scroll within it. So exactly one of these is
   * live at a time, and the letter has to be chased in whichever it is.
   */
  const cardsScroll = useRef<ScrollView | null>(null);
  const chipsScroll = useRef<ScrollView | null>(null);

  const [copiedIcon, setCopiedIcon] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
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

  /**
   * The dot beside the language label — shown until the field is touched.
   *
   * Not `text.length === 0`: the field is SEEDED with SOS, so it is never
   * empty on open and the dot would never appear.
   */
  const showTypeHint = !touchedInput;

  /**
   * Copy the Morse, confirm it twice.
   *
   * ⚠️ Two confirmations on purpose, and they are not redundant. The icon
   * changing to a tick answers "did that button do anything?" at the point the
   * finger is; the toast answers "what did it do?" for anyone who was looking
   * at the text rather than the button. The icon is the fast one and reverts
   * itself; the toast is the explicit one and the user dismisses it.
   */
  /**
   * Empties the field the user is actually typing in.
   *
   * ⚠️ Marks it touched, so the hint dot does not come back. The dot means
   * "you have not started yet", and clearing a message is not starting again.
   */
  const clearInput = useCallback(() => {
    setTouchedInput(true);
    if (toMorse) setText('');
    else setMorseInput('');
  }, [toMorse]);

  /**
   * Puts the clipboard into the field.
   *
   * ⚠️ REPLACES rather than appends. Paste beside Clear reads as "put this
   * here", and appending to a seeded SOS would produce a message nobody asked
   * for. An empty or non-text clipboard does nothing at all — wiping what was
   * typed is the one outcome a Paste button must never produce.
   */
  const pasteInput = useCallback(() => {
    void (async (): Promise<void> => {
      const text = await clipboard.read();
      if (text === null) return;
      setTouchedInput(true);
      if (toMorse) setText(text);
      else setMorseInput(text);
    })();
  }, [clipboard, toMorse]);

  const onCopy = useCallback(() => {
    void (async (): Promise<void> => {
      // Nothing to copy is not a failure to report — there is simply no
      // message yet, and a toast saying so would be noise on an empty screen.
      if (morse.length === 0) return;
      const ok = await clipboard.write(morse);
      if (!ok) return;
      setCopiedIcon(true);
      setCopiedToast(true);
    })();
  }, [clipboard, morse]);

  /**
   * ⚠️ STABLE, via useCallback, and it has to be.
   *
   * `Toast` starts its linger timer in an effect keyed on `[visible,
   * onDismiss]`. An inline arrow is a new function every render, so every
   * re-render of this screen restarted that timer and the toast never
   * dismissed itself at all — it just waited for a tap. The volume toast
   * above is fine only because its handler already comes from a hook.
   */
  const dismissCopiedToast = useCallback(() => setCopiedToast(false), []);

  /**
   * Put the icon back.
   *
   * ⚠️ The timer is cleared on unmount AND on re-copy. Without the cleanup a
   * second copy inside the window leaves the first timer running, and the tick
   * reverts early — the visible symptom being a button that flickers back to
   * `copy` while the toast still says it worked.
   */
  useEffect(() => {
    if (!copiedIcon) return undefined;
    const timer = setTimeout(() => setCopiedIcon(false), COPIED_ICON_MS);
    return () => clearTimeout(timer);
  }, [copiedIcon]);
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

  /**
   * Keeps the sounding letter on screen.
   *
   * ⚠️ `measureLayout` against the scroll view, not the chip's own `onLayout`.
   * A chip's layout is relative to its immediate parent — a word, inside the
   * chip container, inside a card, inside the stack — so its `y` is nowhere
   * near an offset into the thing that scrolls. Measuring against the scroll
   * view is the only reading that means anything, at either layout.
   *
   * Failures are swallowed: the node can be gone by the time the measurement
   * lands, on a message that stopped mid-scroll. Nothing to tell the user.
   */
  const followSoundingLetter = useCallback(
    (node: View | null) => {
      const scroller = tablet ? chipsScroll.current : cardsScroll.current;
      if (!node || !scroller) return;
      const target = scroller as unknown as React.ComponentRef<typeof View>;
      try {
        node.measureLayout(
          target,
          (_x, y) => {
            // A third of the viewport above it, so the letter arrives in
            // reading position rather than pinned to the top edge where the
            // ones after it are invisible.
            scroller.scrollTo({ y: Math.max(0, y - FOLLOW_MARGIN), animated: true });
          },
          () => undefined,
        );
      } catch {
        // Measurement can throw if the tree changed underneath it.
      }
    },
    [tablet],
  );

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
          <ScrollableCards tablet={tablet} scrollRef={cardsScroll}>
            <Card>
              <View style={styles.cardHead}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>
                    {toMorse ? t('translator.sourceLabel') : t('translator.morseLabel')}
                  </Text>
                  {/* ⚠️ Shown only while the field is UNTOUCHED. The input no
                      longer takes focus on open, so something has to say where
                      to start — but a dot that never leaves is decoration, and
                      one that persists after you have typed is a bug report
                      waiting to happen. */}
                  {showTypeHint ? (
                    <View
                      testID="type-hint-dot"
                      accessibilityLabel={t('translator.typeHint')}
                      accessibilityRole="image"
                      style={styles.hintDot}
                    />
                  ) : null}
                </View>
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
                // ⚠️ NOT auto-focused. It used to be, and the keyboard
                // covering half the screen on open was worse than the tap it
                // saved — the seeded sample was hidden behind it. The dot
                // beside the language label is what points here instead.
                style={toMorse ? styles.input : styles.monoInput}
                value={toMorse ? text : morseInput}
                onChangeText={(next) => {
                  setTouchedInput(true);
                  (toMorse ? setText : setMorseInput)(next);
                }}
                onFocus={() => setTouchedInput(true)}
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

              {/* ⚠️ Below the field, not beside the label. Clearing a long
                  message by holding backspace is the thing this replaces, and
                  the hand is already at the bottom of the input when it gives
                  up doing that. */}
              <View style={styles.inputActions}>
                <Pressable
                  testID="clear-input"
                  accessibilityRole="button"
                  accessibilityLabel="clear-input"
                  onPress={clearInput}
                  style={styles.inputAction}
                >
                  <Icon name="backspace" size={15} color={theme.color.muted} />
                  <Text style={styles.inputActionText}>{t('translator.clearAll')}</Text>
                </Pressable>
                <Pressable
                  testID="paste-input"
                  accessibilityRole="button"
                  accessibilityLabel="paste-input"
                  onPress={pasteInput}
                  style={styles.inputAction}
                >
                  <Icon name="copy" size={15} color={theme.color.muted} />
                  <Text style={styles.inputActionText}>{t('translator.paste')}</Text>
                </Pressable>
              </View>
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
                <MorseOutput tablet={tablet} scrollRef={chipsScroll}>
                  <MorseText
                    message={message}
                    selectedIndex={picked}
                    soundingIndex={playback.soundingIndex}
                    onSelectLetter={pickLetter}
                    onSoundingLetter={followSoundingLetter}
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

          <Toast
            visible={playback.lowVolume}
            icon="volume"
            message={t('translator.volumeLow')}
            onDismiss={playback.dismissLowVolume}
          />
          <Toast
            visible={copiedToast}
            icon="check"
            message={t('translator.copied')}
            onDismiss={dismissCopiedToast}
          />
          <OutputChannels cells={channelCells} />

          <View style={styles.actions}>
            <SignalButton
              playing={playback.playing}
              canPlay={playback.canPlay}
              onPress={playback.playing ? playback.stop : playback.play}
              label={playback.playing ? t('translator.stop') : t('translator.play')}
            />
            {/* ⚠️ This did NOTHING until 0.3.2 — `onPress={() => undefined}`.
                It is the same defect a tester reported against Speak in 0.2.1:
                a control drawn on the artboard and never wired, which looks
                identical to a broken one. */}
            <IconButton
              name={copiedIcon ? 'check' : 'copy'}
              label="copy-morse"
              onPress={onCopy}
            />
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
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  inputActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  inputAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  inputActionText: { ...theme.type.hint, color: theme.color.muted },
  label: { ...theme.type.label, color: theme.color.faint, flexShrink: 0 },
  // Deliberately small and in the accent, not a red badge. It points at the
  // field; it is not reporting that anything is wrong.
  hintDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.color.accent,
  },
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
