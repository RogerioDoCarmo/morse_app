import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { NavRail } from '@/components/NavRail';
import { TabBar, type TabName } from '@/components/TabBar';
import { useLayout } from '@/application/useLayout';
import { theme } from '@/theme';

type Props = Readonly<{
  active: TabName;
  onSelect?: ((tab: TabName) => void) | undefined;
  unavailable?: readonly TabName[] | undefined;
  /** Offered on the rail's foot; the phone keeps its gear in the header. */
  onOpenSettings?: (() => void) | undefined;
  children: ReactNode;
}>;

/**
 * The shell every top-level screen sits in — a bottom bar on a phone, a left
 * rail on a tablet.
 *
 * Here rather than in each screen because navigation has to agree across all
 * four: a rail on Translate and a bar on Speak would be two apps.
 */
export function AppFrame({
  active,
  onSelect,
  unavailable,
  onOpenSettings,
  children,
}: Props): React.JSX.Element {
  const { tablet } = useLayout();

  if (tablet) {
    return (
      <View style={styles.row}>
        <NavRail
          active={active}
          onSelect={onSelect}
          unavailable={unavailable}
          onOpenSettings={onOpenSettings}
        />
        <View style={styles.fill}>{children}</View>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {children}
      <TabBar active={active} onSelect={onSelect} unavailable={unavailable} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', backgroundColor: theme.color.ground },
  fill: { flex: 1, minWidth: 0 },
});
