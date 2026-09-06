import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@/application/providers/LocaleProvider';
import { useSettings } from '@/application/providers/SettingsProvider';
import { Icon } from '@/components/Icon';
import { SegmentedControl, type Segment } from '@/components/SegmentedControl';
import { Slider } from '@/components/Slider';
import type { AppLocale } from '@/core/domain/locale';
import { PLAYBACK_WPM_CHOICES } from '@/core/domain/settings';
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
  const insets = useSafeAreaInsets();
  const { settings, setTapUnitMs, setPlaybackWpm, setSpeakDecoded, setCrashReports } =
    useSettings();

  // Segment values are strings, so the speed round-trips through one.
  const speedSegments: readonly Segment<string>[] = PLAYBACK_WPM_CHOICES.map((wpm) => ({
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
            <View style={styles.rule} />
            <NavRow
              testID="settings-speech-locale"
              title={t('settings.speechRecognition')}
              value={LOCALE_LABELS[settings.speechLocale ?? locale]}
              onPress={onOpenLanguage}
            />
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
              onChange={setSpeakDecoded}
            />
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>{t('settings.privacySection')}</Text>
          <View style={styles.card}>
            <ToggleRow
              testID="settings-crash-reports"
              title={t('settings.crashReports')}
              hint={t('settings.crashReportsHint')}
              value={settings.crashReports}
              onChange={setCrashReports}
            />
          </View>
        </View>

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
      </ScrollView>
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
});
