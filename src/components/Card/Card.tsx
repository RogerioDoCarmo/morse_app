import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '@/theme';

type Props = Readonly<{
  children: React.ReactNode;
  /** Let the card take the remaining vertical space. */
  grow?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

/** The white rounded surface every screen is built from. */
export function Card({
  children,
  grow = false,
  style,
  testID,
}: Props): React.JSX.Element {
  return (
    <View testID={testID} style={[styles.card, grow && styles.grow, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.card,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 16,
    boxShadow: theme.shadow.card,
  },
  // flexShrink matters as much as flexGrow here: React Native defaults it to 0,
  // where CSS defaults it to 1. Without it a tall card grows past the container
  // and pushes its siblings out of view instead of scrolling its own content —
  // which is exactly how the action row disappeared on a long message.
  grow: { flexGrow: 1, flexShrink: 1, minHeight: 0 },
});
