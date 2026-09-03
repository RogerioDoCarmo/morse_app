import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { theme } from '@/theme';

type Props = Readonly<{
  name: IconName;
  onPress: () => void;
  /** Locale-independent label — this doubles as the Maestro selector. */
  label: string;
  /**
   * Fills the button with the accent, for a control that is currently doing
   * something — playing, flashing. The label stays put so the selector does
   * not change underneath a test; the state is carried by
   * `accessibilityState` the way the flash button carries its own.
   */
  active?: boolean;
  testID?: string;
}>;

/** A square secondary action, as used in the Translator's action row. */
export function IconButton({
  name,
  onPress,
  label,
  active = false,
  testID,
}: Props): React.JSX.Element {
  return (
    <Pressable
      testID={testID ?? label}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        active && styles.active,
        pressed && styles.pressed,
      ]}
    >
      <Icon
        name={name}
        size={19}
        color={active ? theme.color.onAccent : theme.color.ink}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 54,
    height: 54,
    borderRadius: theme.radius.chip,
    backgroundColor: theme.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: theme.shadow.raised,
  },
  active: { backgroundColor: theme.color.accent },
  // CSS :active has no equivalent; Pressable's pressed state carries it instead.
  pressed: { opacity: 0.7 },
});
