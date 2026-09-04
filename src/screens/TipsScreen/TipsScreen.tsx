import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@/application/providers/LocaleProvider';
import { Icon } from '@/components/Icon';
import type { TranslationKey } from '@/i18n';
import { theme } from '@/theme';

/** The five that work, in the order the design puts them. */
const TIPS: readonly Readonly<{ title: TranslationKey; body: TranslationKey }>[] = [
  { title: 'tips.oneTitle', body: 'tips.oneBody' },
  { title: 'tips.twoTitle', body: 'tips.twoBody' },
  { title: 'tips.threeTitle', body: 'tips.threeBody' },
  { title: 'tips.fourTitle', body: 'tips.fourBody' },
  { title: 'tips.fiveTitle', body: 'tips.fiveBody' },
];

type Props = Readonly<{ onBack: () => void }>;

/**
 * How to memorise Morse — built from `design/screens/Tips.dc.html`.
 *
 * Reached only from Learn, so it carries a back arrow rather than a tab. The
 * last card is deliberately the habit to AVOID, and is styled apart from the
 * five so it cannot be skimmed as a sixth thing to do.
 */
export function TipsScreen({ onBack }: Props): React.JSX.Element {
  const { t } = useLocale();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="tips-screen">
      <View style={styles.header}>
        <Pressable
          testID="tips-back"
          accessibilityRole="button"
          accessibilityLabel="tips-back"
          onPress={onBack}
          style={styles.back}
        >
          <Icon name="arrowLeft" size={22} color={theme.color.ink} strokeWidth={2} />
        </Pressable>
        <Text style={styles.wordmark}>{t('tips.title')}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + theme.spacing.xl },
        ]}
      >
        <Text style={styles.intro}>{t('tips.intro')}</Text>

        {TIPS.map((tip, index) => (
          <View key={tip.title} style={styles.card} testID={`tip-${String(index + 1)}`}>
            <View style={styles.number}>
              <Text style={styles.numberLabel}>{String(index + 1)}</Text>
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>{t(tip.title)}</Text>
              <Text style={styles.cardBody}>{t(tip.body)}</Text>
            </View>
          </View>
        ))}

        {/* The habit to avoid, set apart so it is not skimmed as a sixth thing
            to do. */}
        <View style={styles.avoid} testID="tip-avoid">
          <Text style={styles.avoidTitle}>{t('tips.avoidTitle')}</Text>
          <Text style={styles.avoidBody}>{t('tips.avoidBody')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.ground },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  back: {
    width: theme.hitTarget,
    height: theme.hitTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { ...theme.type.wordmark, color: theme.color.ink },
  scroll: { flex: 1 },
  content: { paddingHorizontal: theme.gutter, paddingTop: 10, gap: theme.spacing.md },
  intro: { ...theme.type.body, fontSize: 15, lineHeight: 22, color: theme.color.muted },
  card: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: 18,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.card,
    boxShadow: theme.shadow.card,
  },
  number: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.accentTint,
  },
  numberLabel: { ...theme.type.chip, color: theme.color.accentDeep },
  cardCopy: { flex: 1, gap: theme.spacing.xs },
  cardTitle: { ...theme.type.action, fontSize: 16, color: theme.color.ink },
  cardBody: { ...theme.type.body, lineHeight: 21, color: theme.color.muted },
  avoid: {
    padding: 18,
    borderRadius: theme.radius.card,
    backgroundColor: theme.color.groundAlt,
    gap: theme.spacing.xs,
  },
  avoidTitle: { ...theme.type.action, fontSize: 16, color: theme.color.ink },
  avoidBody: { ...theme.type.body, lineHeight: 21, color: theme.color.muted },
});
