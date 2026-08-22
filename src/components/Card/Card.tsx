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
  grow: { flexGrow: 1, minHeight: 0 },
});
