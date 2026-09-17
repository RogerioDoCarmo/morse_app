import { useCallback, useEffect, useState } from 'react';
import { usePorts } from '@/application/providers/PortsProvider';
import {
  SAMPLE_SEED_KEY,
  SAMPLE_SEED_VERSION,
  shouldSeedSample,
} from '@/core/domain/sampleSeed';

/** Whether the field still owes the user a sample, and how to settle it. */
export type SampleSeed = Readonly<{
  /**
   * Null until storage has answered, then true or false.
   *
   * ⚠️ THREE-STATE ON PURPOSE, unlike {@link useLetterHint}'s boolean. A hint
   * that starts off and turns on merely appears a beat late. A field that
   * starts empty and fills would drop the sample INTO a message someone had
   * already begun typing, so the Translator waits for the answer instead of
   * guessing.
   */
  seed: boolean | null;
  /**
   * Marks it seeded, in storage only.
   *
   * ⚠️ Deliberately does NOT flip `seed`. The shell unmounts a screen on
   * every tab change, and a value that turned false the moment it was spent
   * would take the sample away on the way back from Speak. The question is
   * whether this DEVICE has been shown it, which storage now answers for the
   * next launch; within this launch the answer must not move.
   */
  spend: () => void;
}>;

/** Decides whether the Translator opens holding the sample, and remembers. */
export function useSampleSeed(): SampleSeed {
  const { preferences } = usePorts();
  const [seed, setSeed] = useState<boolean | null>(null);

  useEffect(() => {
    let listening = true;
    void preferences.read(SAMPLE_SEED_KEY).then((seen) => {
      if (!listening) return;
      setSeed(shouldSeedSample(seen));
    });
    return () => {
      listening = false;
    };
  }, [preferences]);

  const spend = useCallback((): void => {
    // Not awaited, for the reason useLetterHint gives: a failed write costs one
    // more seeding, not anything the user is stuck with.
    void preferences.write(SAMPLE_SEED_KEY, String(SAMPLE_SEED_VERSION));
  }, [preferences]);

  return { seed, spend };
}
