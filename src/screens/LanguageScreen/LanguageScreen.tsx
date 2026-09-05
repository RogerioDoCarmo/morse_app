import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@/application/providers/LocaleProvider';
import { useSettings } from '@/application/providers/SettingsProvider';
import { Icon } from '@/components/Icon';
import { SUPPORTED_LOCALES, type AppLocale } from '@/core/domain/locale';
import type { TranslationKey } from '@/i18n';
import { theme } from '@/theme';

/** Endonyms: a language is listed the way its own speakers write it. */
const NATIVE: Readonly<Record<AppLocale, string>> = {
  en: 'English',
  'pt-BR': 'Português (Brasil)',
  es: 'Español',
};

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

  const follows = settings.speechLocale === null;
  const speechLocale = settings.speechLocale ?? locale;

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
                title={NATIVE[value]}
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
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.rowTitle}>{t('language.matchInterface')}</Text>
                <Text style={styles.hint}>
                  {t('language.matchInterfaceHint', { language: t(NAME_KEY[locale]) })}
                </Text>
              </View>
              <Switch
                testID="speech-follows"
                accessibilityLabel="speech-follows"
                value={follows}
                onValueChange={(next) => {
                  // Turning it off starts from wherever it already listens,
                  // which is the interface — so nothing changes until a
                  // different recogniser is picked below.
                  setSpeechLocale(next ? null : locale);
                }}
                trackColor={{ false: theme.color.track, true: theme.color.accent }}
                thumbColor={theme.color.surface}
              />
            </View>

            {/* The artboard pushes to a fourth screen here. Three options do
                not earn one, so they open in place. */}
            {follows ? null : (
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
            )}
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
      {selected ? (
        <View style={styles.tick}>
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
  rowTitle: { ...theme.type.action, color: theme.color.ink },
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    minHeight: 64,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  toggleCopy: { flex: 1, gap: 2 },
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
