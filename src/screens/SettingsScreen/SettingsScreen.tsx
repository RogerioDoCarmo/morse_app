import React, { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_VERSION_FULL } from '@/appVersion';
import { Toast } from '@/components/Toast';
import { useBuildFeatures } from '@/application/providers/BuildFeaturesProvider';
import { useLocale } from '@/application/providers/LocaleProvider';
import { useSettings } from '@/application/providers/SettingsProvider';
import { Icon } from '@/components/Icon';
import { SegmentedControl, type Segment } from '@/components/SegmentedControl';
import { Slider } from '@/components/Slider';
import type { AppLocale } from '@/core/domain/locale';
import { enabledPlaybackWpm } from '@/core/domain/featureFlags';
import { CALIBRATION_MARKS, calibrateUnitMs } from '@/core/domain/calibration';
import { MAX_UNIT_MS, MIN_UNIT_MS } from '@/core/domain/tapping';
import { theme } from '@/theme';

/** Endonyms: a language is listed the way its own speakers write it. */
const LOCALE_LABELS: Readonly<Record<AppLocale, string>> = {
  en: 'English',
  'pt-BR': 'Português',
  es: 'Español',
};

type Props = Readonly<{
  onBack: () => void;
  /** The ABOUT row's destination — the Learn screen already answers it. */
  onOpenLearn: () => void;
  /** Both LANGUAGE rows lead here; the Language screen owns both locales. */
  onOpenLanguage: () => void;
  /** Shows the welcome guide again — the only way back to it after Skip. */
  onShowGuide: () => void;
}>;

/**
 * Every preference the app keeps, built from `design/screens/Settings.dc.html`.
 *
 * No tab bar: Settings is reached from the gear on the Translator and left by
 * the arrow, so it sits above the tabs rather than beside them.
 */
export function SettingsScreen({
  onBack,
  onOpenLearn,
  onOpenLanguage,
  onShowGuide,
}: Props): React.JSX.Element {
  const { t, locale } = useLocale();
  // What this build contains. A feature it leaves out has no row here at all:
  // a switch for crash reports in a build with no crash reporter would be a
  // setting that does nothing, which is worse than no setting.
  const features = useBuildFeatures();

  /**
   * What the last switch did, echoed back.
   *
   * ⚠️ A platform Switch animates, which reads as "something happened" but not
   * as WHICH thing — on a row whose title and hint are two lines of small
   * grey text, a tester could not tell afterwards whether they had turned
   * crash reports on or off. The toast says the setting by name and the state
   * in words.
   */
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const dismissConfirmation = useCallback(() => setConfirmation(null), []);

  const confirming = useCallback(
    (setting: string, apply: (next: boolean) => void) =>
      (next: boolean): void => {
        apply(next);
        setConfirmation(
          t(next ? 'settings.turnedOn' : 'settings.turnedOff', { setting }),
        );
      },
    [t],
  );
  const insets = useSafeAreaInsets();
  const { settings, setTapUnitMs, setPlaybackWpm, setSpeakDecoded, setCrashReports } =
    useSettings();

  // The cut-off measured instead of guessed. It opens in place, under the
  // slider it sets, so the value it lands on is the one the user sees change.
  const [calibrating, setCalibrating] = useState(false);
  const calibrated = useCallback(
    (ms: number): void => {
      setTapUnitMs(ms);
      setCalibrating(false);
      setConfirmation(t('settings.calibrateDone', { ms: String(ms) }));
    },
    [setTapUnitMs, t],
  );

  // Segment values are strings, so the speed round-trips through one.
  // ⚠️ The FLAGGED list, not every speed the app can render. A speed switched
  // off in `featureFlags.ts` must disappear from the picker, or it is still
  // one tap away from whatever it was switched off for.
  const speedSegments: readonly Segment<string>[] = enabledPlaybackWpm().map((wpm) => ({
    value: String(wpm),
    label: t('settings.wpm', { wpm: String(wpm) }),
  }));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="settings-screen">
      <View style={styles.header}>
        <Pressable
          testID="settings-back"
          accessibilityRole="button"
          accessibilityLabel="settings-back"
          onPress={onBack}
          style={styles.back}
        >
          <Icon name="arrowLeft" size={22} color={theme.color.ink} strokeWidth={2.1} />
        </Pressable>
        <Text style={styles.wordmark}>{t('settings.title')}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: theme.spacing.xl + insets.bottom },
        ]}
      >
        <View style={styles.block}>
          <Text style={styles.label}>{t('settings.tapSection')}</Text>
          <View style={styles.card}>
            <View style={styles.headline}>
              <Text style={styles.rowTitle}>{t('settings.cutoff')}</Text>
              <Text testID="settings-cutoff-value" style={styles.value}>
                {`${String(settings.tapUnitMs)} ms`}
              </Text>
            </View>
            <Text style={styles.hint}>{t('settings.cutoffHint')}</Text>
            <Slider
              testID="settings-cutoff"
              accessibilityLabel={t('settings.cutoff')}
              value={settings.tapUnitMs}
              min={MIN_UNIT_MS}
              max={MAX_UNIT_MS}
              step={10}
              onChange={setTapUnitMs}
            />
            <View style={styles.ends}>
              <Text style={styles.end}>{String(MIN_UNIT_MS)}</Text>
              <Text style={styles.end}>{String(MAX_UNIT_MS)}</Text>
            </View>
            {calibrating ? (
              <Calibration
                onCalibrated={calibrated}
                onCancel={() => {
                  setCalibrating(false);
                }}
              />
            ) : (
              <Pressable
                testID="settings-calibrate"
                accessibilityRole="button"
                accessibilityLabel="settings-calibrate"
                onPress={() => {
                  setCalibrating(true);
                }}
                style={({ pressed }) => [styles.link, pressed && styles.pressedLink]}
              >
                <Icon name="tap" size={17} color={theme.color.accent} />
                <Text style={styles.linkLabel}>{t('settings.calibrate')}</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Both rows lead to the same screen: it holds the interface locale
            and the recogniser locale, which are separate settings but one
            decision to sit down and make. */}
        <View style={styles.block}>
          <Text style={styles.label}>{t('settings.languageSection')}</Text>
          <View style={styles.cardFlush}>
            <NavRow
              testID="settings-language"
              title={t('settings.language')}
              value={LOCALE_LABELS[locale]}
              onPress={onOpenLanguage}
            />
            {features.speechInput ? (
              <>
                <View style={styles.rule} />
                <NavRow
                  testID="settings-speech-locale"
                  title={t('settings.speechRecognition')}
                  value={LOCALE_LABELS[settings.speechLocale ?? locale]}
                  onPress={onOpenLanguage}
                />
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>{t('settings.outputSection')}</Text>
          <View style={styles.card}>
            <Text style={styles.rowTitle}>{t('settings.playbackSpeed')}</Text>
            <SegmentedControl
              testID="settings-speed"
              segments={speedSegments}
              value={String(settings.playbackWpm)}
              onChange={(next) => {
                setPlaybackWpm(Number(next));
              }}
            />
            <View style={styles.rule} />
            <ToggleRow
              testID="settings-read-aloud"
              title={t('settings.readAloud')}
              hint={t('settings.readAloudHint')}
              value={settings.speakDecoded}
              onChange={confirming(t('settings.readAloud'), setSpeakDecoded)}
            />
          </View>
        </View>

        {/* The whole section, not just the row: crash reports are the only
            thing in it, and an empty PRIVACY heading reads as something
            missing rather than nothing to say. */}
        {features.crashReporting ? (
          <View style={styles.block} testID="settings-privacy">
            <Text style={styles.label}>{t('settings.privacySection')}</Text>
            <View style={styles.card}>
              <ToggleRow
                testID="settings-crash-reports"
                title={t('settings.crashReports')}
                hint={t('settings.crashReportsHint')}
                value={settings.crashReports}
                onChange={confirming(t('settings.crashReports'), setCrashReports)}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.label}>{t('settings.aboutSection')}</Text>
          <View style={styles.cardFlush}>
            {/* The guide explains that Light and Sound can be changed at any
                time, which is the one thing a user who skipped it will not
                have been told anywhere else. */}
            <Pressable
              testID="settings-show-guide"
              accessibilityRole="button"
              accessibilityLabel="settings-show-guide"
              onPress={onShowGuide}
              style={({ pressed }) => [styles.settingRow, pressed && styles.pressedRow]}
            >
              <View style={styles.toggleCopy}>
                <Text style={styles.rowTitle}>{t('settings.showGuide')}</Text>
                <Text style={styles.hint}>{t('settings.showGuideHint')}</Text>
              </View>
              <Icon name="chevronRight" size={16} color={theme.color.faint} />
            </Pressable>
            <View style={styles.rule} />
            <Pressable
              testID="settings-about-morse"
              accessibilityRole="button"
              accessibilityLabel="settings-about-morse"
              onPress={onOpenLearn}
              style={({ pressed }) => [styles.settingRow, pressed && styles.pressedRow]}
            >
              <Text style={styles.rowTitle}>{t('settings.aboutMorse')}</Text>
              <Icon name="chevronRight" size={16} color={theme.color.faint} />
            </Pressable>
          </View>
        </View>

        {/* Last thing on the last screen, which is where every app puts it and
            where a tester goes looking. It is the only way to tell which build
            is on the phone: Firebase App Distribution hands out several in a
            day and they are otherwise identical from the inside. */}
        <Text testID="settings-version" style={styles.version}>
          {t('settings.version', { version: APP_VERSION_FULL })}
        </Text>
      </ScrollView>
      <Toast
        visible={confirmation !== null}
        message={confirmation ?? ''}
        icon="check"
        onDismiss={dismissConfirmation}
      />
    </View>
  );
}

/**
 * Measures the cut-off from three dots and three dashes.
 *
 * ⚠️ The ORDER is the instruction, and it is what makes this possible: a press
 * cannot be called a dot or a dash before there is a cut-off to judge it by,
 * so the first three are dots because they come first. Only durations are
 * kept — the silences between presses say nothing about where the cut-off is.
 */
function Calibration({
  onCalibrated,
  onCancel,
}: Readonly<{
  onCalibrated: (ms: number) => void;
  onCancel: () => void;
}>): React.JSX.Element {
  const { t } = useLocale();
  const [durations, setDurations] = useState<readonly number[]>([]);
  const [down, setDown] = useState(false);
  /** The last attempt could not tell a dot from a dash. */
  const [unreadable, setUnreadable] = useState(false);
  const pressedAt = useRef(0);
  const total = CALIBRATION_MARKS.dots + CALIBRATION_MARKS.dashes;

  const onDown = useCallback((): void => {
    pressedAt.current = Date.now();
    setDown(true);
  }, []);

  const onUp = useCallback((): void => {
    setDown(false);
    const next = [...durations, Date.now() - pressedAt.current];
    if (next.length < total) {
      setDurations(next);
      return;
    }
    // Starts again from nothing either way: a half-kept attempt would mix the
    // marks of two different tries.
    setDurations([]);
    const ms = calibrateUnitMs(
      next.slice(0, CALIBRATION_MARKS.dots),
      next.slice(CALIBRATION_MARKS.dots),
    );
    if (ms === null) {
      setUnreadable(true);
      return;
    }
    onCalibrated(ms);
  }, [durations, onCalibrated, total]);

  // What is asked for, in order, lit as each one is done.
  const marks = Array.from({ length: total }, (_, index) => ({
    dash: index >= CALIBRATION_MARKS.dots,
    done: index < durations.length,
  }));

  return (
    <View style={styles.calibration} testID="settings-calibration">
      <Text testID="settings-calibrate-hint" style={styles.hint}>
        {t(unreadable ? 'settings.calibrateRetry' : 'settings.calibrateHint')}
      </Text>
      <View style={styles.calibrationMarks}>
        {marks.map((mark, index) => (
          <View
            key={`c${String(index)}`}
            testID={
              mark.done ? 'settings-calibrate-mark-done' : 'settings-calibrate-mark'
            }
            style={[
              mark.dash ? styles.calibrationDash : styles.calibrationDot,
              mark.done ? styles.markDone : styles.markWaiting,
            ]}
          />
        ))}
      </View>
      <View style={styles.calibrationControls}>
        <Pressable
          testID="settings-calibrate-cancel"
          accessibilityRole="button"
          accessibilityLabel="settings-calibrate-cancel"
          onPress={onCancel}
          style={({ pressed }) => [styles.link, pressed && styles.pressedLink]}
        >
          <Text style={styles.linkLabel}>{t('settings.calibrateCancel')}</Text>
        </Pressable>
        <Pressable
          testID="settings-calibrate-key"
          accessibilityRole="button"
          accessibilityLabel="settings-calibrate-key"
          accessibilityState={{ selected: down }}
          onPressIn={onDown}
          onPressOut={onUp}
          style={[styles.calibrationKey, down && styles.calibrationKeyDown]}
        >
          <Text style={styles.calibrationKeyLabel}>{t('tap.key')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** A title, the value it currently holds, and a chevron saying it opens. */
function NavRow({
  testID,
  title,
  value,
  onPress,
}: Readonly<{
  testID: string;
  title: string;
  value: string;
  onPress: () => void;
}>): React.JSX.Element {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.settingRow, pressed && styles.pressedRow]}
    >
      <Text style={styles.rowTitle}>{title}</Text>
      <View style={styles.rowValue}>
        <Text style={styles.valueText}>{value}</Text>
        <Icon name="chevronRight" size={16} color={theme.color.faint} />
      </View>
    </Pressable>
  );
}

/** A title, a line of explanation, and the switch they belong to. */
function ToggleRow({
  testID,
  title,
  hint,
  value,
  onChange,
}: Readonly<{
  testID: string;
  title: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
}>): React.JSX.Element {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      {/* The platform switch rather than a drawn one: it carries its own
          accessibility semantics, and it is what a user of either OS expects
          a setting to look like. */}
      <Switch
        testID={testID}
        accessibilityLabel={testID}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.color.track, true: theme.color.accent }}
        thumbColor={theme.color.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.ground },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 48,
    paddingHorizontal: theme.gutter,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -12,
  },
  wordmark: { ...theme.type.wordmark, color: theme.color.ink },
  scroll: { flex: 1 },
  content: { paddingHorizontal: theme.gutter, paddingTop: 10, gap: theme.spacing.lg },
  block: { gap: theme.spacing.sm },
  label: { ...theme.type.label, color: theme.color.faint, paddingHorizontal: 4 },
  card: {
    padding: 18,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.card,
    boxShadow: theme.shadow.card,
    gap: theme.spacing.md,
  },
  headline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  rowTitle: { ...theme.type.action, color: theme.color.ink },
  value: { ...theme.type.mono, fontSize: 15, color: theme.color.accent },
  hint: { ...theme.type.hint, fontSize: 13, lineHeight: 19, color: theme.color.muted },
  ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -12 },
  end: { ...theme.type.mono, fontSize: 11, color: theme.color.faint },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.sm,
    minHeight: theme.hitTarget,
  },
  linkLabel: { ...theme.type.chip, color: theme.color.accent },
  pressedLink: { opacity: 0.6 },
  calibration: {
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.border,
  },
  calibrationMarks: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  calibrationDot: { width: 10, height: 10, borderRadius: 5 },
  calibrationDash: { width: 26, height: 10, borderRadius: 5 },
  markDone: { backgroundColor: theme.color.accent },
  markWaiting: { backgroundColor: theme.color.track },
  calibrationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Smaller than the Tap screen's 186pt key, which is the whole of that
  // screen; this one is a control inside a card.
  calibrationKey: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.accent,
  },
  calibrationKeyDown: { transform: [{ scale: 0.965 }] },
  calibrationKeyLabel: {
    ...theme.type.control,
    color: theme.color.onAccent,
    textAlign: 'center',
  },
  rule: { height: 1, backgroundColor: theme.color.border },
  // Rows run to the card's edge, so the card carries no padding of its own.
  cardFlush: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.card,
    boxShadow: theme.shadow.card,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    minHeight: 58,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  pressedRow: { backgroundColor: theme.color.groundAlt },
  rowValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  valueText: { ...theme.type.body, fontSize: 15, color: theme.color.muted },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  toggleCopy: { flex: 1, gap: 2 },
  version: {
    ...theme.type.hint,
    fontSize: 12,
    color: theme.color.faint,
    textAlign: 'center',
    paddingTop: theme.spacing.sm,
  },
});
