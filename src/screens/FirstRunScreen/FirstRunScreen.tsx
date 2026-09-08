import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@/application/providers/LocaleProvider';
import { useLayout } from '@/application/useLayout';
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

/**
 * A TUPLE, not a `readonly Slide[]`. `SLIDES[0]` has to be a slide rather than
 * a maybe-slide for the tablet column to render one without a fallback, and
 * under `noUncheckedIndexedAccess` only a tuple says so.
 */
const SLIDES = [
  { title: 'firstRun.oneTitle', body: 'firstRun.oneBody', show: 'chips' },
  { title: 'firstRun.twoTitle', body: 'firstRun.twoBody', show: 'channels' },
  { title: 'firstRun.threeTitle', body: 'firstRun.threeBody', show: 'letter' },
] as const satisfies readonly Slide[];

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

type PagerProps = Readonly<{
  index: number;
  onIndex: (next: number) => void;
  /** One element per slide, in order. */
  pages: readonly React.ReactNode[];
  style: StyleProp<ViewStyle>;
}>;

/**
 * The swipe.
 *
 * Every page is mounted side by side and the ScrollView pages between them,
 * which is what makes the gesture free: there is nothing to animate by hand
 * and nothing to interpolate. `index` stays the single source of truth — Next
 * moves it and the pager follows, a swipe moves the pager and it reports back
 * — so the dots and the button never disagree with what is on screen.
 *
 * The page width comes from `onLayout` rather than `Dimensions`: this thing
 * sits inside a two-column layout on a tablet, where the screen's width is not
 * the pager's.
 */
function Pager({ index, onIndex, pages, style }: PagerProps): React.JSX.Element {
  const scroller = useRef<ScrollView | null>(null);
  // Seeded from the window rather than from zero. `onLayout` arrives a frame
  // after the first paint, and pages a frame wide of zero is a blank carousel
  // for that frame — on the very first screen a new user ever sees. The window
  // is the right answer on a phone and one frame too wide inside the tablet's
  // column, which corrects itself the moment the real width lands.
  const window = useWindowDimensions();
  const [width, setWidth] = useState(window.width);

  // Follows `index` whenever something else moved it — Next, or Skip on a
  // layout where Skip does not leave. Scrolling to where it already is costs
  // nothing, so a swipe that set the index does not need excluding.
  useEffect(() => {
    if (width > 0) scroller.current?.scrollTo({ x: index * width, animated: true });
  }, [index, width]);

  const measure = (event: LayoutChangeEvent): void => {
    setWidth(event.nativeEvent.layout.width);
  };

  const settled = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    if (width <= 0) return;
    const landed = Math.round(event.nativeEvent.contentOffset.x / width);
    if (landed !== index) onIndex(landed);
  };

  /**
   * The same, for a page that never announced itself.
   *
   * ⚠️ A momentum event is not guaranteed. The CI emulator runs with
   * `animator_duration_scale 0`, and a paging scroll view there can finish its
   * snap inside the drag and emit no `onMomentumScrollEnd` at all — the swipe
   * moved the pager, the dots did not follow, and the flow failed on a screen
   * whose own screenshot showed the slide it was asserting against.
   *
   * Trusted only when the offset has ALREADY landed on a page boundary. A drag
   * that still has a snap coming is somewhere in between, and reading a page
   * out of it would fight the snap.
   */
  const dragged = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    if (width <= 0) return;
    const offset = event.nativeEvent.contentOffset.x;
    if (Math.abs(offset - Math.round(offset / width) * width) < 1) settled(event);
  };

  return (
    <ScrollView
      testID="first-run-pager"
      ref={scroller}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onLayout={measure}
      onMomentumScrollEnd={settled}
      onScrollEndDrag={dragged}
      style={style}
    >
      {pages.map((page, page_index) => (
        <View
          key={SLIDES[page_index]?.title ?? String(page_index)}
          style={{ width }}
          testID={`first-run-page-${String(page_index)}`}
        >
          {page}
        </View>
      ))}
    </ScrollView>
  );
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

  // Two columns only where both halves fit; a tablet in portrait keeps one
  // column, capped so it is not a phone layout stretched across an iPad.
  const { tablet, twoColumns } = useLayout();

  const slide: Slide = SLIDES[index] ?? SLIDES[0];
  const last = index === SLIDES.length - 1;

  // Named so both layouts can compose the same markup without wrappers that
  // would change the phone's flex arithmetic. An earlier version wrapped both
  // groups in flex:1 containers, which split the screen in half and lifted the
  // button off the bottom on EVERY device.
  const stage = (each: Slide): React.JSX.Element => (
    <View
      style={[styles.stage, twoColumns && styles.stageWide]}
      testID={`first-run-art-${each.show}`}
    >
      {each.show === 'chips' ? (
        <View style={styles.card}>
          <Text style={styles.sample}>{sample}</Text>
          <MorseText message={sampleMessage} testID="first-run-chips" />
        </View>
      ) : null}

      {each.show === 'channels' ? <OutputChannels cells={strip(t)} /> : null}

      {each.show === 'letter' ? (
        <View style={styles.card}>
          <MorseText message={oneLetter} selectedIndex={1} testID="first-run-letter" />
        </View>
      ) : null}
    </View>
  );

  const copy = (each: Slide): React.JSX.Element => (
    <View style={styles.copy}>
      <Text style={[styles.title, tablet && styles.titleWide]}>{t(each.title)}</Text>
      <Text style={[styles.body, tablet && styles.bodyWide]}>{t(each.body)}</Text>
    </View>
  );

  const dots = (
    <View style={[styles.dots, twoColumns && styles.dotsWide]} testID="first-run-dots">
      {SLIDES.map((each, dot) => (
        <View
          key={each.title}
          // One testID each, and the current one says so through
          // `accessibilityState` rather than through a different testID. A
          // reader that only counts dots cannot tell you WHICH one is lit, and
          // every page of the carousel is mounted at once now, so "which" is
          // the only question left worth asking.
          testID={`first-run-dot-${String(dot)}`}
          accessibilityState={{ selected: dot === index }}
          style={[styles.dot, dot === index && styles.dotOn]}
        />
      ))}
    </View>
  );

  const next = (
    <Pressable
      testID="first-run-next"
      accessibilityRole="button"
      accessibilityLabel="first-run-next"
      onPress={() => {
        if (last) onDone();
        else setIndex(index + 1);
      }}
      style={({ pressed }) => [
        styles.next,
        twoColumns && styles.nextWide,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.nextLabel}>
        {last ? t('firstRun.start') : t('firstRun.next')}
      </Text>
    </Pressable>
  );

  return (
    <View
      testID="first-run"
      style={[
        styles.screen,
        tablet && !twoColumns && styles.screenWide,
        { paddingTop: insets.top, paddingBottom: insets.bottom + 20 },
      ]}
    >
      <View style={styles.top}>
        {last ? null : (
          <Pressable
            testID="first-run-skip"
            accessibilityRole="button"
            accessibilityLabel="first-run-skip"
            // Leaves. It used to jump to the last slide instead, on the
            // reasoning that Start should be the single way out — but a person
            // who presses Skip has said what they want, and answering it with
            // one more slide and one more button reads as the guide refusing
            // to let go. Settings keeps a row that brings it back.
            onPress={onDone}
            style={styles.skip}
          >
            <Text style={styles.skipLabel}>{t('firstRun.skip')}</Text>
          </Pressable>
        )}
      </View>

      {twoColumns ? (
        <View style={styles.columns}>
          {/* Only the illustration swipes here. The copy sits in its own
              column beside it and changes with the index, which keeps the two
              halves of the artboard's tablet layout where they were drawn. */}
          <Pager
            index={index}
            onIndex={setIndex}
            style={styles.pagerWide}
            pages={SLIDES.map((each) => stage(each))}
          />
          <View style={styles.side}>
            {copy(slide)}
            {dots}
            {next}
          </View>
        </View>
      ) : (
        <>
          <Pager
            index={index}
            onIndex={setIndex}
            style={styles.pager}
            pages={SLIDES.map((each) => (
              <>
                {stage(each)}
                {copy(each)}
              </>
            ))}
          />
          {dots}
          {next}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.ground },
  // One column on a tablet still gets a cap: a measure drawn for 390pt read
  // across 834 is not a layout, it is a phone screen stretched.
  screenWide: { maxWidth: 620, width: '100%', alignSelf: 'center' },
  // Side by side, capped so neither half becomes an unreadable measure on a
  // wider iPad. Without this the carousel is a phone screen with empty bands
  // above and below it.
  columns: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 64,
    paddingHorizontal: 72,
    paddingBottom: 56,
  },
  side: { flex: 1, maxWidth: 480, justifyContent: 'center' },
  stageWide: { maxWidth: 520, paddingHorizontal: 0 },
  // The pager takes the room the illustration used to, on both layouts: it is
  // the illustration now, with two more beside it off screen.
  pager: { flex: 1 },
  pagerWide: { flex: 1, maxWidth: 520 },
  // The dots belong to the words they are pacing, so they line up with the
  // copy rather than centring under a column that is only half the screen.
  dotsWide: { justifyContent: 'flex-start', paddingHorizontal: theme.spacing.xl },
  titleWide: { fontSize: 32 },
  bodyWide: { fontSize: 17, lineHeight: 26 },
  // Sized to its words rather than the column: a 480pt Start button reads as
  // a banner, not something to press.
  nextWide: { alignSelf: 'flex-start', minWidth: 200, paddingHorizontal: 32 },
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
