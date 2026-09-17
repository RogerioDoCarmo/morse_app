import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@/application/providers/LocaleProvider';
import { Icon, type IconName } from '@/components/Icon';
import type { PermissionKind } from '@/core/domain/permission';
import type { TranslationKey } from '@/i18n';
import { theme } from '@/theme';

/**
 * Every string and glyph that differs between the two permissions. Collected
 * so the screen below has no `kind === 'camera'` branches scattered through
 * its markup — there is exactly one place where the two differ.
 */
const COPY: Readonly<
  Record<
    PermissionKind,
    Readonly<{
      icon: IconName;
      title: TranslationKey;
      headline: TranslationKey;
      body: TranslationKey;
      assurance: TranslationKey;
      blocked: TranslationKey;
    }>
  >
> = {
  camera: {
    icon: 'zap',
    title: 'permission.cameraTitle',
    headline: 'permission.cameraHeadline',
    body: 'permission.cameraRationale',
    assurance: 'permission.cameraAssurance',
    blocked: 'permission.cameraBlocked',
  },
  microphone: {
    icon: 'mic',
    title: 'permission.microphoneTitle',
    headline: 'permission.microphoneHeadline',
    body: 'permission.microphoneRationale',
    assurance: 'permission.microphoneAssurance',
    blocked: 'permission.microphoneBlocked',
  },
};

type Props = Readonly<{
  kind: PermissionKind;
  /** True once only the system settings can change the answer. */
  blocked: boolean;
  /** Prompts the OS. Not offered when blocked — the OS would not show it. */
  onAllow: () => void;
  onOpenSettings: () => void;
  onDismiss: () => void;
}>;

/**
 * The rationale shown BEFORE the system prompt — built from
 * `design/screens/Permissions.dc.html`.
 *
 * It exists because the OS dialog gets one sentence and one chance: a user who
 * denies there can only be recovered through the system settings. Saying why
 * first, in the app's own words, is what makes the prompt answerable.
 *
 * Both permissions are optional. Everything the app does without them keeps
 * working — but the way past is the OS dialog, not a button here.
 *
 * ⚠️ BEFORE the prompt there is exactly ONE action, and it leads to the prompt.
 * App Review rejected 0.3.4 (13) under guideline 5.1.1(iv) for the two things
 * that used to be here: a primary button reading "Allow microphone access"
 * (Apple asks for "Continue" or "Next"), and a "Not now" button that let the
 * user close this screen and DELAY the system request. Apple's words: "The user
 * should always proceed to the permission request after the message."
 *
 * The blocked state is different and keeps its second button: the OS will not
 * show a prompt once a permission is blocked, so "Open Settings" plus a way
 * back is the only thing that can be offered — and it is what Apple's own
 * guidance suggests for that case.
 */
export function PermissionScreen({
  kind,
  blocked,
  onAllow,
  onOpenSettings,
  onDismiss,
}: Props): React.JSX.Element {
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const copy = COPY[kind];

  return (
    <View
      style={[styles.screen, { paddingTop: insets.top }]}
      testID={`permission-${kind}`}
    >
      <View style={styles.header}>
        <Text style={styles.wordmark}>{t(copy.title)}</Text>
      </View>

      <View style={styles.body}>
        <View style={blocked ? styles.badgeMuted : styles.badge}>
          <Icon
            name={copy.icon}
            size={30}
            color={blocked ? theme.color.faint : theme.color.accentDeep}
            strokeWidth={1.9}
          />
        </View>

        <Text testID="permission-headline" style={styles.headline}>
          {blocked ? t(copy.blocked) : t(copy.headline)}
        </Text>
        <Text style={styles.rationale}>
          {blocked ? t('permission.blockedHint') : t(copy.body)}
        </Text>

        {/* Kept in the blocked state too: the reason a user is deciding at
            all is what the app does NOT do with the permission. */}
        <View style={styles.assurance}>
          <Icon name="info" size={17} color={theme.color.muted} strokeWidth={2} />
          <Text style={styles.assuranceText}>{t(copy.assurance)}</Text>
        </View>
      </View>

      <View style={[styles.actions, { paddingBottom: theme.spacing.lg + insets.bottom }]}>
        <Pressable
          testID="permission-primary"
          accessibilityRole="button"
          accessibilityLabel="permission-primary"
          onPress={blocked ? onOpenSettings : onAllow}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          {/* ⚠️ "Continue", not "Allow <thing> access" — guideline 5.1.1(iv)
              asks for a neutral word here, and the same button is used for
              both permissions because the label no longer names one. */}
          <Text style={styles.primaryLabel}>
            {blocked ? t('permission.openSettings') : t('permission.continue')}
          </Text>
        </Pressable>

        {/* Blocked only — see the note above the component. A second button
            BEFORE the prompt is what guideline 5.1.1(iv) rejected. */}
        {blocked ? (
          <Pressable
            testID="permission-dismiss"
            accessibilityRole="button"
            accessibilityLabel="permission-dismiss"
            onPress={onDismiss}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryLabel}>{t('permission.goBack')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.ground },
  header: { height: 48, justifyContent: 'center', paddingHorizontal: theme.gutter },
  wordmark: { ...theme.type.wordmark, color: theme.color.ink },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.gutter,
    gap: theme.spacing.md,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: theme.color.accentTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  badgeMuted: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: theme.color.groundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  headline: { ...theme.type.title, color: theme.color.ink },
  rationale: {
    ...theme.type.body,
    fontSize: 15,
    lineHeight: 23,
    color: theme.color.muted,
  },
  assurance: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    marginTop: theme.spacing.sm,
    backgroundColor: theme.color.groundAlt,
    borderRadius: 16,
  },
  assuranceText: {
    ...theme.type.hint,
    fontSize: 13,
    lineHeight: 19,
    color: theme.color.muted,
    flex: 1,
  },
  actions: { paddingHorizontal: theme.gutter, gap: theme.spacing.sm },
  primary: {
    height: 54,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { ...theme.type.action, fontSize: 16, color: theme.color.onInk },
  secondary: { height: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { ...theme.type.action, color: theme.color.muted },
  pressed: { opacity: 0.85 },
});
