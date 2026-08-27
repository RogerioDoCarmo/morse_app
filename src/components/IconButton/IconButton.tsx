import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { theme } from '@/theme';

type Props = Readonly<{
  name: IconName;
  onPress: () => void;
  /** Locale-independent label — this doubles as the Maestro selector. */
  label: string;
  testID?: string;
}>;

/** A square secondary action, as used in the Translator's action row. */
export function IconButton({ name, onPress, label, testID }: Props): React.JSX.Element {
  return (
    <Pressable
      testID={testID ?? label}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Icon name={name} size={19} color={theme.color.ink} />
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
  // CSS :active has no equivalent; Pressable's pressed state carries it instead.
  pressed: { opacity: 0.7 },
});
