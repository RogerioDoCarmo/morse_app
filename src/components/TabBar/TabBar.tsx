import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { useLocale } from '@/application/providers/LocaleProvider';
import type { TranslationKey } from '@/i18n/keys';
import { theme } from '@/theme';

/**
 *
 */
export type TabName = 'translate' | 'speak' | 'tap' | 'learn';

const TABS: readonly Readonly<{ name: TabName; icon: IconName; key: TranslationKey }>[] =
  [
    { name: 'translate', icon: 'translate', key: 'nav.translate' },
    { name: 'speak', icon: 'mic', key: 'nav.speak' },
    { name: 'tap', icon: 'tap', key: 'nav.tap' },
    { name: 'learn', icon: 'book', key: 'nav.learn' },
  ];

type Props = Readonly<{
  active: TabName;
  onSelect?: (tab: TabName) => void;
}>;

/**
 * The bottom navigation, shared by every top-level screen.
 *
 * The artboards repeat this markup in all seven phone screens; here it exists
 * once. On tablet it becomes a side rail — same destinations, different shell.
 */
export function TabBar({ active, onSelect }: Props): React.JSX.Element {
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="tab-bar"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, theme.spacing.md) }]}
    >
      {TABS.map((tab) => {
        const selected = tab.name === active;
        return (
          <Pressable
            key={tab.name}
            testID={`tab-${tab.name}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`tab-${tab.name}`}
            onPress={() => onSelect?.(tab.name)}
            style={[styles.tab, selected && styles.tabActive]}
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
