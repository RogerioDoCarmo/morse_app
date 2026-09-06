import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import type { OutputChannel } from '@/application/useMorsePlayback';
import { theme } from '@/theme';

/** One cell: what it drives, what it looks like, and what it is called. */
export type ChannelCell = Readonly<{
  channel: OutputChannel | 'screen' | 'buzz';
  icon: IconName;
  label: string;
  on: boolean;
  /** Absent on a channel that is designed but not built yet. */
  onToggle?: () => void;
}>;

type Props = Readonly<{
  cells: readonly ChannelCell[];
  testID?: string;
}>;

/**
 * The output strip — which ways the one message is sent.
 *
 * Multi-select rather than a segmented control: the message can go out several
 * ways at once, and a segmented control would say otherwise.
 */
export function OutputChannels({
  cells,
  testID = 'output-channels',
}: Props): React.JSX.Element {
  return (
    <View style={styles.row} testID={testID}>
      {cells.map((cell) => {
        const idle = cell.onToggle === undefined;
        return (
          <Pressable
            key={cell.channel}
            testID={`channel-${cell.channel}`}
            accessibilityRole="button"
            accessibilityLabel={`channel-${cell.channel}`}
            accessibilityState={{ selected: cell.on, disabled: idle }}
            disabled={idle}
            onPress={cell.onToggle}
            style={({ pressed }) => [
              styles.cell,
              cell.on ? styles.cellOn : styles.cellOff,
              idle && styles.cellIdle,
              pressed && styles.pressed,
            ]}
          >
            <Icon
              name={cell.icon}
              size={19}
              color={cell.on ? theme.color.accentDeep : theme.color.faint}
            />
            <Text style={cell.on ? styles.labelOn : styles.label} numberOfLines={1}>
              {cell.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: theme.spacing.sm },
  cell: {
    flex: 1,
    height: 58,
    borderRadius: theme.radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  cellOn: { backgroundColor: theme.color.accentTint },
  cellOff: { backgroundColor: theme.color.surface, boxShadow: theme.shadow.raised },
  // Designed but not built. Flat rather than raised, so it does not invite a
  // press it cannot answer.
  cellIdle: {
    backgroundColor: theme.color.groundAlt,
    boxShadow: undefined,
    opacity: 0.6,
  },
  pressed: { opacity: 0.7 },
  label: { ...theme.type.tabIdle, fontSize: 10, color: theme.color.faint },
  labelOn: { ...theme.type.tab, fontSize: 10, color: theme.color.accentDeep },
});
