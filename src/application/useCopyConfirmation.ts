import { useCallback, useEffect, useState } from 'react';
import { usePorts } from '@/application/providers/PortsProvider';

/**
 * How long a copy button shows a tick before turning back into a copy icon.
 *
 * Long enough to be seen if you glanced away, short enough that the button is
 * itself again before you would reach for it a second time.
 *
 * ⚠️ 1.8s was the first value and it was too tight to OBSERVE. A single
 * Maestro assertion on a software-rendered emulator can take longer than that,
 * so the tick had reverted before the flow could look at it — a state that
 * exists but cannot be checked is one nobody can defend against a regression.
 * 2.5s reads the same to a person and leaves the test somewhere to stand.
 */
export const COPIED_ICON_MS = 2500;

/** A copy action and the two ways it says it worked. */
export type CopyConfirmation = Readonly<{
  /** Writes the text to the clipboard. Empty text does nothing at all. */
  copy: (text: string) => void;
  /** True while the button should show a tick. Reverts on its own. */
  ticked: boolean;
  /** True while the "Copied" toast should show. The toast dismisses it. */
  toast: boolean;
  /** Stable, so the toast's linger timer is not restarted on every render. */
  dismissToast: () => void;
}>;

/**
 * Copy, confirmed twice — shared by every screen with a Copy button.
 *
 * ⚠️ TWO states, not one, and they have different lifetimes on purpose. The
 * tick is a fast acknowledgement at the fingertip and reverts itself after
 * {@link COPIED_ICON_MS}; the toast is the explicit message, for anyone who was
 * looking at the text rather than the button, and lives the Toast's own linger
 * time or until it is tapped away.
 *
 * They shared one `copied` flag at first. The icon's timer then cleared the
 * toast as well, so the toast was gone in under two seconds instead of six —
 * and the E2E flow failed asserting it, on a slow emulator, in the gap between
 * checking the icon and checking the toast.
 */
export function useCopyConfirmation(): CopyConfirmation {
  const { clipboard } = usePorts();
  const [ticked, setTicked] = useState(false);
  const [toast, setToast] = useState(false);

  const copy = useCallback(
    (text: string): void => {
      void (async (): Promise<void> => {
        // Nothing to copy is not a failure to report — there is simply no
        // message yet, and a toast saying so would be noise on an empty screen.
        if (text.length === 0) return;
        const ok = await clipboard.write(text);
        if (!ok) return;
        setTicked(true);
        setToast(true);
      })();
    },
    [clipboard],
  );

  // ⚠️ STABLE, via useCallback, and it has to be. `Toast` starts its linger
  // timer in an effect keyed on `[visible, onDismiss]`; an inline arrow is a
  // new function every render, and the toast never dismissed itself at all.
  const dismissToast = useCallback(() => setToast(false), []);

  // ⚠️ The timer is cleared on unmount AND on re-copy. Without the cleanup a
  // second copy inside the window leaves the first timer running, and the tick
  // reverts early — a button that flickers back to `copy` while the toast
  // still says it worked.
  useEffect(() => {
    if (!ticked) return undefined;
    const timer = setTimeout(() => setTicked(false), COPIED_ICON_MS);
    return () => clearTimeout(timer);
  }, [ticked]);

  return { copy, ticked, toast, dismissToast };
}
