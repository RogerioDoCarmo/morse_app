import { useCallback, useEffect, useState } from 'react';
import { usePorts } from '@/application/providers/PortsProvider';
import {
  LETTER_HINT_KEY,
  LETTER_HINT_VERSION,
  shouldHintLetterTap,
} from '@/core/domain/letterHint';

/** Whether the chips still owe the user a nudge, and how to settle it. */
export type LetterHint = Readonly<{
  /**
   * False until the stored value has been read.
   *
   * ⚠️ It starts OFF and turns on, never the other way round. Starting it on
   * would pulse at everyone for the beat before storage answers — including
   * the users who learned this months ago, who would see the hint flicker
   * once on every message.
   */
  show: boolean;
  /**
   * Marks it learned. Called when a chip is tapped, by whatever route — the
   * point is that the user has done the thing, not that they were told.
   */
  spend: () => void;
}>;

/** Decides whether the letter chips point at themselves, and remembers. */
export function useLetterHint(): LetterHint {
  const { preferences } = usePorts();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let listening = true;
    void preferences.read(LETTER_HINT_KEY).then((seen) => {
      if (!listening) return;
      setShow(shouldHintLetterTap(seen));
    });
    return () => {
      listening = false;
    };
  }, [preferences]);

  const spend = useCallback((): void => {
    // ⚠️ Written even when the hint was never showing. A user who found the
    // chips on their own has learned exactly what the pulse teaches, and
    // pointing at it afterwards would be the app explaining something back to
    // someone who just did it.
    setShow(false);
    // Not awaited: a write that fails is reported by the adapter, and its cost
    // is one more pulse rather than anything the user is stuck with.
    void preferences.write(LETTER_HINT_KEY, String(LETTER_HINT_VERSION));
  }, [preferences]);

  return { show, spend };
}
