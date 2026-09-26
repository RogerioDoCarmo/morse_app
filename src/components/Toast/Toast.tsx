import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { theme } from '@/theme';

/** How long it stays before taking itself away. */
const LINGER_MS = 6000;

type Props = Readonly<{
  visible: boolean;
  message: string;
  /**
   * The glyph beside the message.
   *
   * ⚠️ No default, deliberately. This was hardcoded to `volume`, which was
   * right for the one toast that existed and then appeared beside "Copiado" on
   * the next one — a speaker icon on a message about the clipboard. A toast
   * that cannot say what it is about should show nothing rather than inherit
   * whatever the first one needed.
   */
  icon?: IconName;
  /** Called when it is dismissed, by tap or by timeout. */
  onDismiss: () => void;
  /**
   * An optional way out, beside the message.
   *
   * ⚠️ It does NOT dismiss on its own. The caller decides — opening the
   * system settings sends the user out of the app, and a toast that vanished
   * on the way would leave nothing to come back to.
   */
  action?: Readonly<{ label: string; onPress: () => void }>;
}>;

/**
 * A message that explains something the screen cannot show.
 *
 * The app has exactly one of these, for exactly one thing: a phone too quiet
 * to hear the Sound channel. That is deliberate — a toast is an interruption,
 * and the moment there are several the user stops reading them.
 *
 * ⚠️ It dismisses itself. A warning about a volume the user is ALREADY fixing
 * should not need a tap to go away, and one that outlives the message it was
 * about is just clutter over the next thing they do.
 */
export function Toast({
  visible,
  message,
  icon,
  onDismiss,
  action,
}: Props): React.JSX.Element | null {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, LINGER_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        testID="toast"
        // `alert` so a screen reader announces it without being asked — the
        // whole point is that the user is not looking at this part of the
        // screen, they are waiting to hear something.
        accessibilityRole="alert"
        accessibilityLabel={message}
        onPress={onDismiss}
        style={({ pressed }) => [styles.toast, pressed && styles.pressed]}
      >
        {icon ? (
          <Icon name={icon} size={17} color={theme.color.onInk} strokeWidth={2} />
        ) : null}
        <Text style={styles.message}>{message}</Text>
        {/* ⚠️ Inside the Pressable, not beside it. A second Pressable would
            make the toast two targets in a 44pt strip, and the outer one
            dismisses — a near miss on the action would delete the thing the
            user was reaching for. Pressing anywhere still dismisses; pressing
            the label does the action first. */}
        {action ? (
          <Text
            testID="toast-action"
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            style={styles.action}
          >
            {action.label}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Bright against the ink, because it is the one thing here worth pressing.
  action: {
    ...theme.type.label,
    color: theme.color.accent,
    marginLeft: 'auto',
    paddingLeft: theme.spacing.md,
  },
  // Above the pinned controls rather than over them: the Emit button is what
  // the user just pressed and may want to press again.
  wrap: { paddingHorizontal: theme.gutter, paddingBottom: theme.spacing.sm },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink,
  },
  pressed: { opacity: 0.85 },
  message: {
    ...theme.type.hint,
    fontSize: 13,
    lineHeight: 18,
    color: theme.color.onInk,
    flex: 1,
  },
});
