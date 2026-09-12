import React from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { Icon } from '@/components/Icon';
import { SUPPORTED_LOCALES, type AppLocale } from '@/core/domain/locale';
import { NATIVE_LOCALE_NAMES } from '@/i18n/localeNames';
import { theme } from '@/theme';

type Props = Readonly<{
  visible: boolean;
  locale: AppLocale;
  /** Where the header badge sits, so the menu opens under it. */
  top: number;
  onSelect: (locale: AppLocale) => void;
  onDismiss: () => void;
}>;

/**
 * The three interface languages, as a list to choose from.
 *
 * ⚠️ This replaces a CYCLE, and the cycle was the wrong shape. Tapping the
 * badge stepped EN → PT → ES, which is fine for the person who built it and
 * hostile to everyone else: nothing on screen says what the next tap will do,
 * reaching Spanish from English costs two taps, and a reader who overshoots
 * into a language they do not speak has to keep tapping a badge they can no
 * longer read to get home. A list shows all three at once and costs one tap
 * from anywhere.
 *
 * A `Modal` rather than an absolutely-positioned view: the menu has to sit
 * above the cards, and the cards scroll. It also has to close when the user
 * taps anywhere else, and a full-screen backdrop is the only thing that
 * reliably catches that on both platforms.
 */
export function LocaleMenu({
  visible,
  locale,
  top,
  onSelect,
  onDismiss,
}: Props): React.JSX.Element {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Android's hardware back must close the menu rather than leave the
      // screen — a dismissable thing that swallows Back is worse than no menu.
      onRequestClose={onDismiss}
    >
      <Pressable
        testID="locale-menu-backdrop"
        accessibilityRole="button"
        accessibilityLabel="locale-menu-backdrop"
        style={styles.backdrop}
        onPress={onDismiss}
      >
        {/* The card stops the press so tapping inside does not dismiss. A
            `Pressable` with no handler is enough: the backdrop's press never
            reaches it. */}
        <Pressable
          testID="locale-menu"
          style={[styles.card, { top }]}
          onPress={() => undefined}
        >
          {SUPPORTED_LOCALES.map((value, index) => {
            const selected = value === locale;
            return (
              <Pressable
                key={value}
                testID={`locale-option-${value}`}
                accessibilityRole="button"
                accessibilityLabel={`locale-option-${value}`}
                accessibilityState={{ selected }}
                onPress={() => {
                  onSelect(value);
                }}
                style={[styles.row, index === 0 && styles.first]}
              >
                <Text style={[styles.name, selected && styles.nameSelected]}>
                  {NATIVE_LOCALE_NAMES[value]}
                </Text>
                {/* The tick marks where you are. Without it the menu answers
                    "which languages exist" and not "which one am I in". */}
                {selected ? (
                  <Icon
                    name="check"
                    size={16}
                    color={theme.color.accent}
                    strokeWidth={2.4}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(16, 24, 32, 0.18)' },
  card: {
    position: 'absolute',
    right: theme.gutter,
    minWidth: 208,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.control,
    boxShadow: theme.shadow.raised,
  },
  row: {
    minHeight: theme.hitTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  // The divider belongs BETWEEN rows, not above the first one.
  first: { borderTopWidth: 0 },
  name: { ...theme.type.body, color: theme.color.ink },
  nameSelected: { color: theme.color.accentDeep },
});
