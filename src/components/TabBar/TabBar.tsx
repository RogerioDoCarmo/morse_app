import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { useBuildFeatures } from '@/application/providers/BuildFeaturesProvider';
import { useLocale } from '@/application/providers/LocaleProvider';
import type { BuildFeature, BuildFeatures } from '@/core/domain/buildFeatures';
import type { TranslationKey } from '@/i18n/keys';
import { theme } from '@/theme';

/**
 *
 */
export type TabName = 'translate' | 'speak' | 'tap' | 'learn';

/**
 * The destinations, shared with the rail. One set in two shells: a rail that
 * could list different ones would be a bug waiting to happen.
 */
export const TABS: readonly Readonly<{
  name: TabName;
  icon: IconName;
  key: TranslationKey;
  /** The build feature this destination needs; absent means every build has it. */
  requires?: BuildFeature;
}>[] = [
  { name: 'translate', icon: 'translate', key: 'nav.translate' },
  { name: 'speak', icon: 'mic', key: 'nav.speak', requires: 'speechInput' },
  { name: 'tap', icon: 'tap', key: 'nav.tap' },
  { name: 'learn', icon: 'book', key: 'nav.learn' },
];

/**
 * Whether this build has a destination at all.
 *
 * ⚠️ Different from `unavailable` below, on purpose. An unavailable tab is one
 * the app has not finished, shown greyed so the bar keeps its shape. A tab
 * whose feature the build left out is GONE: there is nothing to finish, and a
 * greyed Speak button in a build with no recogniser would be a promise the
 * build cannot keep.
 */
export function hasTab(name: TabName, features: BuildFeatures): boolean {
  const tab = TABS.find((candidate) => candidate.name === name);
  return tab !== undefined && (tab.requires === undefined || features[tab.requires]);
}

/** The destinations this build has, in bar order. */
export function tabsFor(features: BuildFeatures): typeof TABS {
  return TABS.filter((tab) => hasTab(tab.name, features));
}

type Props = Readonly<{
  active: TabName;
  // Explicitly `| undefined`: exactOptionalPropertyTypes is on, and a screen
  // that takes these as optional props has to be able to pass them straight
  // through without knowing whether it was given them.
  onSelect?: ((tab: TabName) => void) | undefined;
  /**
   * Destinations that do not exist yet. They stay in the bar — the shape of
   * the app is settled and hiding them would make it move as screens land —
   * but they are greyed and inert rather than answering a press with nothing.
   */
  unavailable?: readonly TabName[] | undefined;
}>;

/**
 * The bottom navigation, shared by every top-level screen.
 *
 * The artboards repeat this markup in all seven phone screens; here it exists
 * once. On tablet it becomes a side rail — same destinations, different shell.
 */
export function TabBar({ active, onSelect, unavailable = [] }: Props): React.JSX.Element {
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const features = useBuildFeatures();
  return (
    <View
      testID="tab-bar"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, theme.spacing.md) }]}
    >
      {tabsFor(features).map((tab) => {
        const selected = tab.name === active;
        const missing = unavailable.includes(tab.name);
        return (
          <Pressable
            key={tab.name}
            testID={`tab-${tab.name}`}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled: missing }}
            accessibilityLabel={`tab-${tab.name}`}
            disabled={missing}
            onPress={() => onSelect?.(tab.name)}
            style={[
              styles.tab,
              selected && styles.tabActive,
              missing && styles.tabMissing,
            ]}
          >
            <Icon
              name={tab.icon}
              size={20}
              color={selected ? theme.color.accentDeep : theme.color.faint}
            />
            <Text style={selected ? styles.labelActive : styles.label} numberOfLines={1}>
              {t(tab.key)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: theme.color.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.border,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  tabMissing: { opacity: 0.38 },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.control,
  },
  tabActive: { backgroundColor: theme.color.accentTint },
  label: { ...theme.type.tabIdle, color: theme.color.faint },
  labelActive: { ...theme.type.tab, color: theme.color.accentDeep },
});
