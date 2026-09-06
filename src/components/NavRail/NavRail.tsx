import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { TABS, type TabName } from '@/components/TabBar';
import { useLocale } from '@/application/providers/LocaleProvider';
import { theme } from '@/theme';

/** Width from `design/screens/TabletTranslator.dc.html`. */
const RAIL_WIDTH = 96;

type Props = Readonly<{
  active: TabName;
  onSelect?: ((tab: TabName) => void) | undefined;
  unavailable?: readonly TabName[] | undefined;
  onOpenSettings?: (() => void) | undefined;
}>;

/**
 * The tablet's navigation — the same four destinations as the tab bar, stood
 * up the left edge.
 *
 * Shares `TABS` with the bar rather than restating it: the two are one set of
 * destinations in two shells, and a rail that could list different ones would
 * be a bug waiting to happen.
 *
 * The gear lives down here on tablet. The phone keeps it in the Translator's
 * header, where that screen has a header to put it in; the rail has a foot.
 */
export function NavRail({
  active,
  onSelect,
  unavailable = [],
  onOpenSettings,
}: Props): React.JSX.Element {
  const { t } = useLocale();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID="nav-rail"
      style={[
        styles.rail,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 20 },
      ]}
    >
      {/* The wordmark's dot and dash, which is all of it that fits here. */}
      <View style={styles.mark}>
        <View style={styles.markDot} />
        <View style={styles.markDash} />
      </View>

      {TABS.map((tab) => {
        const off = unavailable.includes(tab.name);
        const on = tab.name === active;
        return (
          <Pressable
            key={tab.name}
            testID={`tab-${tab.name}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: on, disabled: off }}
            accessibilityLabel={`tab-${tab.name}`}
            disabled={off}
            onPress={() => {
              onSelect?.(tab.name);
            }}
            style={[styles.item, on && styles.itemOn]}
          >
            <Icon
              name={tab.icon}
              size={22}
              color={on ? theme.color.accentDeep : theme.color.faint}
              strokeWidth={1.9}
            />
            <Text style={on ? styles.labelOn : styles.label}>{t(tab.key)}</Text>
          </Pressable>
        );
      })}

      <View style={styles.spacer} />

      {onOpenSettings === undefined ? null : (
        <Pressable
          testID="open-settings"
          accessibilityRole="button"
          accessibilityLabel="open-settings"
          onPress={onOpenSettings}
          style={styles.gear}
        >
          <Icon name="settings" size={22} color={theme.color.faint} strokeWidth={1.7} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: RAIL_WIDTH,
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
    backgroundColor: theme.color.surface,
    borderRightWidth: 1,
    borderRightColor: theme.color.border,
  },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 22 },
  markDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.accent },
  markDash: { width: 20, height: 8, borderRadius: 4, backgroundColor: theme.color.ink },
  item: {
    width: 72,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 18,
  },
  itemOn: { backgroundColor: theme.color.accentTint },
  label: { ...theme.type.tabIdle, color: theme.color.faint },
  labelOn: { ...theme.type.tab, color: theme.color.accentDeep },
  spacer: { flexGrow: 1 },
  gear: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
