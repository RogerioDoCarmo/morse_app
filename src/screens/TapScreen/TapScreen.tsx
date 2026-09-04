import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@/application/providers/LocaleProvider';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { TabBar, type TabName } from '@/components/TabBar';
import {
  MAX_UNIT_MS,
  MIN_UNIT_MS,
  classifyGap,
  classifyPress,
  clampUnitMs,
  decodeTaps,
  tapsToMorse,
  type TapPress,
} from '@/core/domain/tapping';
import type { MorseSymbol } from '@/core/domain/morse';
import { theme } from '@/theme';

/** How much one press of the stepper moves the cut-off. */
const STEP_MS = 20;

/** The key's diameter, from the artboard. */
const KEY_SIZE = 186;

type Props = Readonly<{
  onSelectTab: (tab: TabName) => void;
  unavailableTabs: readonly TabName[];
}>;

/**
 * Tap input — built from `design/screens/TapDecode.dc.html`.
 *
 * Press DURATION is the whole input: the key measures how long it was held
 * and how long the silence before it lasted, and the domain turns that into
 * marks. Nothing here decides what a dot is; `classifyPress` does, against a
 * cut-off the operator sets, because "long" is relative to their own speed.
 */
export function TapScreen({ onSelectTab, unavailableTabs }: Props): React.JSX.Element {
  const { t } = useLocale();
  const insets = useSafeAreaInsets();

  const [unitMs, setUnitMs] = useState(clampUnitMs(180));
  const [presses, setPresses] = useState<readonly TapPress[]>([]);
  const [down, setDown] = useState(false);

  /** When the key went down, and when it last came up. */
  const pressedAt = useRef(0);
  const releasedAt = useRef(0);

  const morse = useMemo(() => tapsToMorse(presses, unitMs), [presses, unitMs]);
  const text = useMemo(() => decodeTaps(presses, unitMs), [presses, unitMs]);

  /**
   * The marks of the letter still being keyed.
   *
   * Everything after the last gap that closed a letter. Shown live because a
   * key that gives no feedback until the letter ends is unusable — you cannot
   * tell a dot you meant from a dash you fumbled.
   */
  const letter = useMemo((): readonly MorseSymbol[] => {
    const marks: MorseSymbol[] = [];
    presses.forEach((press, index) => {
      if (index > 0 && classifyGap(press.gapBeforeMs, unitMs) !== 'intra') {
        marks.length = 0;
      }
      marks.push(classifyPress(press.durationMs, unitMs));
    });
    return marks;
  }, [presses, unitMs]);

  const onDown = useCallback((): void => {
    pressedAt.current = Date.now();
    setDown(true);
  }, []);

  const onUp = useCallback((): void => {
    const now = Date.now();
    const durationMs = now - pressedAt.current;
    // The gap before the FIRST press has no preceding letter to close, and the
    // domain ignores it — but it still has to be a number.
    const gapBeforeMs =
      releasedAt.current === 0 ? 0 : pressedAt.current - releasedAt.current;
    releasedAt.current = now;
    setDown(false);
    setPresses((previous) => [...previous, { durationMs, gapBeforeMs }]);
  }, []);

  const step = useCallback((by: number): void => {
    setUnitMs((current) => clampUnitMs(current + by));
  }, []);

  const clear = useCallback((): void => {
    setPresses([]);
    releasedAt.current = 0;
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="tap-screen">
      <View style={styles.header}>
        <Text style={styles.wordmark}>{t('nav.tap')}</Text>
        {presses.length === 0 ? null : (
          <Pressable
            testID="tap-clear"
            accessibilityRole="button"
            accessibilityLabel="tap-clear"
            onPress={clear}
            style={styles.clear}
          >
            <Text style={styles.clearLabel}>{t('tap.clear')}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.body}>
        <Card>
          <Text style={styles.label}>{t('tap.decoded')}</Text>
          {text === '' ? (
            <Text testID="tap-empty" style={styles.emptyHint}>
              {t('tap.hint')}
            </Text>
          ) : (
            <Text testID="tap-decoded" style={styles.decoded}>
              {text}
            </Text>
          )}
          <View style={styles.monoFooter}>
            <Text testID="tap-morse" style={styles.mono}>
              {morse}
            </Text>
          </View>
        </Card>

        <View style={styles.letterRow}>
          <Text style={styles.label}>{t('tap.letter')}</Text>
          <View style={styles.marks} testID="tap-letter">
            {letter.length === 0 ? (
              <>
                <View style={[styles.dot, styles.markEmpty]} />
                <View style={[styles.dash, styles.markEmpty]} />
              </>
            ) : (
              letter.map((mark, index) => (
                <View
                  key={`m${String(index)}`}
                  testID={mark === '.' ? 'tap-mark-dot' : 'tap-mark-dash'}
                  style={[mark === '.' ? styles.dot : styles.dash, styles.markOn]}
                />
              ))
            )}
          </View>
        </View>

        <View style={styles.cutoff}>
          <View style={styles.cutoffCopy}>
            <Text style={styles.cutoffTitle}>{t('tap.cutoff')}</Text>
            <Text style={styles.cutoffHint}>{t('tap.cutoffHint')}</Text>
          </View>
          <View style={styles.stepper}>
            <Pressable
              testID="cutoff-down"
              accessibilityRole="button"
              accessibilityLabel="cutoff-down"
              disabled={unitMs <= MIN_UNIT_MS}
              onPress={() => {
                step(-STEP_MS);
              }}
              style={styles.stepButton}
            >
              <Icon name="minus" size={17} color={theme.color.ink} />
            </Pressable>
            <Text testID="cutoff-value" style={styles.cutoffValue}>
              {`${String(unitMs)} ms`}
            </Text>
            <Pressable
              testID="cutoff-up"
              accessibilityRole="button"
              accessibilityLabel="cutoff-up"
              disabled={unitMs >= MAX_UNIT_MS}
              onPress={() => {
                step(STEP_MS);
              }}
              style={styles.stepButton}
            >
              <Icon name="plus" size={17} color={theme.color.ink} />
            </Pressable>
          </View>
        </View>

        <View style={styles.keyStage}>
          <Pressable
            testID="tap-key"
            accessibilityRole="button"
            accessibilityLabel="tap-key"
            accessibilityState={{ selected: down }}
            onPressIn={onDown}
            onPressOut={onUp}
            style={[styles.key, down && styles.keyDown]}
          >
            {/* A dot and a dash on the key itself: the two things it makes,
                drawn at the size the output draws them. */}
            <View style={styles.keyMarks}>
              <View style={styles.keyDot} />
              <View style={styles.keyDash} />
            </View>
            <Text style={styles.keyLabel}>{t('tap.key')}</Text>
          </Pressable>
        </View>
      </View>

      <TabBar active="tap" onSelect={onSelectTab} unavailable={unavailableTabs} />
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
  clear: {
    height: theme.hitTarget,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    marginRight: -theme.spacing.md,
  },
  clearLabel: { ...theme.type.chip, color: theme.color.accent },
  body: {
    flex: 1,
    paddingHorizontal: theme.gutter,
    paddingTop: 10,
    gap: theme.spacing.md,
  },
  label: {
    ...theme.type.label,
    color: theme.color.faint,
    marginBottom: theme.spacing.sm,
  },
  emptyHint: { ...theme.type.body, fontSize: 17, lineHeight: 24, color: '#b3bac2' },
  decoded: {
    ...theme.type.decoded,
    fontSize: 26,
    lineHeight: 32,
    color: theme.color.ink,
  },
  monoFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.border,
    paddingTop: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  mono: { ...theme.type.mono, color: theme.color.muted },
  letterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    height: 56,
    paddingHorizontal: 18,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.control,
  },
  marks: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dash: { width: 26, height: 10, borderRadius: 5 },
  markOn: { backgroundColor: theme.color.accent },
  markEmpty: { backgroundColor: '#e2e6ea' },
  cutoff: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  cutoffCopy: { flexShrink: 1 },
  cutoffTitle: { ...theme.type.chip, color: theme.color.ink },
  cutoffHint: { ...theme.type.hint, fontSize: 11, color: theme.color.muted },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  stepButton: {
    width: theme.hitTarget,
    height: theme.hitTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cutoffValue: {
    ...theme.type.mono,
    fontSize: 14,
    color: theme.color.ink,
    minWidth: 58,
    textAlign: 'center',
  },
  keyStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: theme.spacing.md,
  },
  /**
   * A 186pt disc, per `design/screens/TapDecode.dc.html`.
   *
   * It was a full-width rounded rectangle until Rogério asked twice for it to
   * be narrower — the artboard had settled this and the screen had drifted.
   * The ring is the design's, and it is what makes a flat disc read as a key
   * rather than a circle drawn on the page.
   */
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.color.accent,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 0,
        blurRadius: 0,
        spreadDistance: 10,
        color: 'rgba(18, 165, 148, 0.12)',
      },
      { offsetX: 0, offsetY: 14, blurRadius: 34, color: 'rgba(18, 165, 148, 0.32)' },
    ],
  },
  // The artboard's :active state, which has no CSS equivalent here.
  keyDown: {
    transform: [{ scale: 0.965 }],
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 0,
        blurRadius: 0,
        spreadDistance: 12,
        color: 'rgba(18, 165, 148, 0.16)',
      },
      { offsetX: 0, offsetY: 6, blurRadius: 16, color: 'rgba(18, 165, 148, 0.28)' },
    ],
  },
  keyMarks: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  keyDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: theme.color.onAccent,
  },
  keyDash: {
    width: 36,
    height: 13,
    borderRadius: 7,
    backgroundColor: theme.color.onAccent,
  },
  keyLabel: { ...theme.type.control, color: theme.color.onAccent },
});
