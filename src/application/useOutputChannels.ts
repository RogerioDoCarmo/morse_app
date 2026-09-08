import { useCallback } from 'react';
import { useLocale } from '@/application/providers/LocaleProvider';
import { usePermissionGate } from '@/application/providers/PermissionGate';
import { useMorsePlayback, type MorsePlayback } from '@/application/useMorsePlayback';
import type { ChannelCell } from '@/components/OutputChannels';
import type { MorseMessage } from '@/core/domain/morse';

/**
 * A message, the four ways it can go out, and the control state for the strip.
 *
 * Lifted out of the Translator when Speak and Tap needed the same thing. A
 * TestFlight tester went looking on those two screens for the way to feel a
 * message as vibration or watch it on the screen, the way the Translator
 * offers, and found nothing — the flows had output and the other two did not.
 *
 * The channels are per screen, not global. That follows the hook this wraps:
 * there is one run, owned by the screen showing the message, and a channel
 * switched on here has no business changing what another screen would do with
 * a different message.
 */
export function useOutputChannels(
  message: MorseMessage,
  unitMs?: number,
): Readonly<{ playback: MorsePlayback; cells: readonly ChannelCell[] }> {
  const { t } = useLocale();
  const { ensure } = usePermissionGate();
  const playback = useMorsePlayback(message, unitMs);

  // Switching Light on is what raises the camera permission, so the rationale
  // belongs here rather than at playback: a user who says no should be told
  // why it was asked, not watch a channel silently refuse to light.
  const lightToggled = useCallback(async (): Promise<void> => {
    if (playback.channels.light) {
      playback.toggleChannel('light');
      return;
    }
    if (await ensure('camera')) playback.toggleChannel('light');
  }, [ensure, playback]);

  // The `translator.*` keys are the channels' names, not the Translator's —
  // they were written before there was anywhere else to show them, and
  // renaming them would churn three locale files to say the same words.
  const cells: readonly ChannelCell[] = [
    {
      channel: 'sound',
      icon: 'volume',
      label: t('translator.channelSound'),
      on: playback.channels.sound,
      onToggle: () => {
        playback.toggleChannel('sound');
      },
    },
    {
      channel: 'light',
      icon: 'zap',
      label: t('translator.channelLight'),
      on: playback.channels.light,
      onToggle: () => {
        void lightToggled();
      },
    },
    {
      channel: 'screen',
      icon: 'screen',
      label: t('translator.channelScreen'),
      on: playback.channels.screen,
      onToggle: () => {
        playback.toggleChannel('screen');
      },
    },
    {
      channel: 'buzz',
      icon: 'vibrate',
      label: t('translator.channelBuzz'),
      on: playback.channels.buzz,
      onToggle: () => {
        playback.toggleChannel('buzz');
      },
    },
  ];

  return { playback, cells };
}
