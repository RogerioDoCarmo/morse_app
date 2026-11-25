import { useCallback, useMemo, useRef, useState } from 'react';
import { usePorts } from '@/application/providers/PortsProvider';
import type { MorseMessage } from '@/core/domain/morse';
import { clampPlaybackUnitMs, toTimeline } from '@/core/domain/timeline';
import { renderWav } from '@/core/domain/tone';

/** Sharing a message as a sound file, and the one way it can say it failed. */
export type ShareSound = Readonly<{
  /** Renders the message and opens the share sheet. Ignored while one is open. */
  share: () => void;
  /** False when there is nothing to hear: no message, or only unsupported text. */
  canShare: boolean;
  /** True from the press until the sheet closes. */
  sharing: boolean;
  /** True while the "could not share" toast should show. The toast dismisses it. */
  failed: boolean;
  /** Stable, so the toast's linger timer is not restarted on every render. */
  dismissFailed: () => void;
}>;

/**
 * Shares the message as the same sound the Emit button plays.
 *
 * Same message, same speed and the same renderer as playback, so what the
 * recipient hears is what the sender heard. It does NOT depend on the output
 * channels: muting the Sound channel decides what this phone plays, not what
 * the user may send.
 *
 * ⚠️ Rendered on press, never per render. A long message is hundreds of
 * kilobytes of samples, and every keystroke in the field re-renders the screen.
 *
 * Nothing is said on success: the share sheet itself is the confirmation. Both
 * failures, a device that cannot share and a sheet that would not open, get
 * the same message, because the user's options are the same for each.
 */
export function useShareSound(
  message: MorseMessage,
  unitMs: number,
  title: string,
): ShareSound {
  const { shareSound } = usePorts();
  const [sharing, setSharing] = useState(false);
  const [failed, setFailed] = useState(false);
  // A ref as well as the state: two presses inside one render would both see
  // `sharing` false and open two sheets.
  const busy = useRef(false);

  const timeline = useMemo(() => toTimeline(message), [message]);
  const canShare = timeline.totalUnits > 0;

  const share = useCallback((): void => {
    if (!canShare || busy.current) return;
    busy.current = true;
    setSharing(true);
    void (async (): Promise<void> => {
      const wav = renderWav(timeline, { unitMs: clampPlaybackUnitMs(unitMs) });
      const result = await shareSound.share(wav, title);
      busy.current = false;
      setSharing(false);
      if (result !== 'shared') setFailed(true);
    })();
  }, [canShare, shareSound, timeline, title, unitMs]);

  const dismissFailed = useCallback(() => setFailed(false), []);

  return { share, canShare, sharing, failed, dismissFailed };
}
