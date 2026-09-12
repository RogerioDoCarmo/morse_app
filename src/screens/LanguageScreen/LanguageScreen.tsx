import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@/application/providers/LocaleProvider';
import { usePorts } from '@/application/providers/PortsProvider';
import { useSettings } from '@/application/providers/SettingsProvider';
import { Icon } from '@/components/Icon';
import { SUPPORTED_LOCALES, type AppLocale } from '@/core/domain/locale';
import type { TranslationKey } from '@/i18n';
import { NATIVE_LOCALE_NAMES } from '@/i18n/localeNames';
import { theme } from '@/theme';

/** The same language named in whatever language the reader is already in. */
const NAME_KEY: Readonly<Record<AppLocale, TranslationKey>> = {
  en: 'language.nameEn',
  'pt-BR': 'language.namePt',
  es: 'language.nameEs',
};

/**
 * How each recogniser is labelled, matching the BCP-47 tags the speech adapter
 * actually asks for. Not translated: these name a specific regional voice
 * pack, and translating "English (US)" would misdescribe what is installed.
 */
const RECOGNISER: Readonly<Record<AppLocale, string>> = {
  en: 'English (US)',
  'pt-BR': 'Português (Brasil)',
  es: 'Español (España)',
};

type Props = Readonly<{ onBack: () => void }>;

/**
 * The interface language and the recogniser language, which are separate —
 * built from `design/screens/Language.dc.html`.
 *
 * A device may simply not have a given recogniser installed, so recognition
 * follows the interface by default and can be pointed elsewhere.
 */
export function LanguageScreen({ onBack }: Props): React.JSX.Element {
  const { t, locale, setLocale } = useLocale();
  const insets = useSafeAreaInsets();
  const { settings, setSpeechLocale } = useSettings();
  const { locale: localePort } = usePorts();

  // ⚠️ The DEVICE locale, not the interface one — the two are independent.
  const speechLocale = settings.speechLocale ?? localePort.getDeviceLocale();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="language-screen">
      <View style={styles.header}>
        <Pressable
          testID="language-back"
          accessibilityRole="button"
          accessibilityLabel="language-back"
          onPress={onBack}
          style={styles.back}
        >
          <Icon name="arrowLeft" size={22} color={theme.color.ink} strokeWidth={2.1} />
        </Pressable>
        <Text style={styles.wordmark}>{t('language.title')}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: theme.spacing.xl + insets.bottom },
        ]}
      >
        <View style={styles.block}>
          <Text style={styles.label}>{t('language.interface')}</Text>
          <View style={styles.card} testID="language-interface">
            {SUPPORTED_LOCALES.map((value, index) => (
              <ChoiceRow
                key={value}
                testID={`interface-${value}`}
                title={NATIVE_LOCALE_NAMES[value]}
                subtitle={t(NAME_KEY[value])}
                selected={value === locale}
                first={index === 0}
                onPress={() => {
                  setLocale(value);
                }}
              />
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>{t('language.speech')}</Text>
          <View style={styles.card}>
            {/* ⚠️ No "Match the interface" toggle any more. Recognition used
                to follow the app language unless this was switched off, so
                changing the UI silently changed what the microphone listened
                for. They are two settings now, and the list is always here
                rather than hidden behind a switch. */}
            <View testID="language-recogniser">
              <Text style={styles.subLabel}>{t('language.recogniseIn')}</Text>
              {SUPPORTED_LOCALES.map((value, index) => (
                <ChoiceRow
                  key={value}
                  testID={`recogniser-${value}`}
                  title={RECOGNISER[value]}
                  selected={value === speechLocale}
                  first={index === 0}
                  onPress={() => {
                    setSpeechLocale(value);
                  }}
                />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.footnote}>
          <Icon name="info" size={17} color={theme.color.muted} strokeWidth={2} />
          <Text style={styles.footnoteText}>{t('language.footnote')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

/** One selectable language, with the tick that says it is the current one. */
function ChoiceRow({
  testID,
  title,
  subtitle,
  selected,
  first,
  onPress,
}: Readonly<{
  testID: string;
  title: string;
  subtitle?: string;
  selected: boolean;
  first: boolean;
  onPress: () => void;
}>): React.JSX.Element {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        !first && styles.divided,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceTitle}>{title}</Text>
        {subtitle === undefined ? null : <Text style={styles.hint}>{subtitle}</Text>}
      </View>
      {/* ⚠️ `${testID}-tick`, so which row is SELECTED can be asserted without
          reading rendered text. The flows used to prove a language change by
          looking for a translated heading; that passed on Android and failed on
          iOS, where an accessible container folds its children's text into its
          own label and the individual strings stop being separate elements.
          A testID means the same thing on both platforms. */}
      {selected ? (
        <View testID={`${testID}-tick`} style={styles.tick}>
          <Icon name="check" size={15} color={theme.color.onAccent} strokeWidth={3} />
        </View>
      ) : (
        <View style={styles.untick} />
      )}
    </Pressable>
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
  content: { paddingHorizontal: theme.gutter, paddingTop: 8, gap: theme.spacing.lg },
  block: { gap: theme.spacing.sm },
  label: { ...theme.type.label, color: theme.color.faint, paddingHorizontal: 4 },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.card,
    boxShadow: theme.shadow.card,
    overflow: 'hidden',
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    minHeight: 64,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  divided: { borderTopWidth: 1, borderTopColor: theme.color.border },
  pressed: { backgroundColor: theme.color.groundAlt },
  choiceCopy: { flex: 1, gap: 1 },
  choiceTitle: { ...theme.type.action, fontSize: 16, color: theme.color.ink },
  hint: { ...theme.type.hint, fontSize: 13, lineHeight: 18, color: theme.color.muted },
  subLabel: {
    ...theme.type.label,
    color: theme.color.faint,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 2,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  tick: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  untick: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#dfe3e8',
  },
  footnote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    backgroundColor: theme.color.groundAlt,
    borderRadius: 16,
  },
  footnoteText: {
    ...theme.type.hint,
    fontSize: 13,
    lineHeight: 19,
    color: theme.color.muted,
    flex: 1,
  },
});
