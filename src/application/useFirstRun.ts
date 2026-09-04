import { useCallback, useEffect, useState } from 'react';
import { usePorts } from '@/application/providers/PortsProvider';
import {
  FIRST_RUN_KEY,
  FIRST_RUN_VERSION,
  shouldShowFirstRun,
} from '@/core/domain/firstRun';

/** Whether the guide is due, and how to put it away. */
export type FirstRun = Readonly<{
  /**
   * False until the stored value has been read. The app shows nothing at all
   * until then: flashing the Translator for a frame and then covering it with
   * the guide is worse than a beat of empty ground.
   */
  ready: boolean;
  show: boolean;
  dismiss: () => void;
}>;

/** Decides whether to show the first-run guide, and remembers the answer. */
export function useFirstRun(): FirstRun {
  const { preferences } = usePorts();
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let listening = true;
    void preferences.read(FIRST_RUN_KEY).then((seen) => {
      if (!listening) return;
      setShow(shouldShowFirstRun(seen));
      setReady(true);
    });
    return () => {
      listening = false;
    };
  }, [preferences]);

  const dismiss = useCallback((): void => {
    setShow(false);
    // Not awaited: the guide closes now, and a write that fails is reported by
    // the adapter. The cost of a failure is seeing it again, not being stuck.
    void preferences.write(FIRST_RUN_KEY, String(FIRST_RUN_VERSION));
  }, [preferences]);

  return { ready, show, dismiss };
}
