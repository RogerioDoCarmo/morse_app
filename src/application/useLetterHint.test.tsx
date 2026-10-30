import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { LETTER_HINT_KEY, LETTER_HINT_VERSION } from '@/core/domain/letterHint';
import type { Ports } from '@/core/ports';
import {
  createFakePorts,
  type FakePorts,
  unansweredPreferences,
} from '@/testing/fakePorts';
import { PortsProvider } from './providers/PortsProvider';
import { useLetterHint } from './useLetterHint';

function Probe(): React.JSX.Element {
  const { show, spend } = useLetterHint();
  return (
    <>
      <Text testID="state">{show ? 'point' : 'quiet'}</Text>
      <Text testID="spend" onPress={spend}>
        tapped
      </Text>
    </>
  );
}

const writes: { key: string; value: string }[] = [];

const withSeen = (seen: string | null): FakePorts => {
  const preferences: Ports['preferences'] = {
    read: async () => seen,
    write: async (key: string, value: string) => {
      writes.push({ key, value });
    },
  };
  return createFakePorts({ preferences });
};

const renderProbe = async (ports: FakePorts): Promise<void> => {
  await render(
    <PortsProvider ports={ports}>
      <Probe />
    </PortsProvider>,
  );
};

describe('useLetterHint', () => {
  beforeEach(() => {
    writes.length = 0;
  });

  /**
   * ⚠️ OFF FIRST, ON AFTERWARDS — never the other way round. Storage answers a
   * beat after the first render, and a hint that started on would flicker once
   * on every message for every user who learned this months ago.
   */
  it('points at nothing until storage has answered', async () => {
    await renderProbe(createFakePorts({ preferences: unansweredPreferences }));

    expect(screen.getByTestId('state')).toHaveTextContent('quiet');
  });

  it('points at the chips on a device that has never tapped one', async () => {
    await renderProbe(withSeen(null));

    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('point');
    });
  });

  it('stays quiet on a device that has already been shown this hint', async () => {
    await renderProbe(withSeen(String(LETTER_HINT_VERSION)));

    // Nothing to wait FOR — the assertion is that it never turns on — so the
    // read is allowed to land first and then checked.
    await waitFor(() => {
      expect(writes).toHaveLength(0);
    });
    expect(screen.getByTestId('state')).toHaveTextContent('quiet');
  });

  it('stops pointing the moment a chip is tapped', async () => {
    await renderProbe(withSeen(null));
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('point');
    });

    await fireEvent.press(screen.getByTestId('spend'));

    expect(screen.getByTestId('state')).toHaveTextContent('quiet');
  });

  // The key and the value both asserted literally: a version written under
  // the wrong key is a hint that comes back on every launch forever.
  it('remembers that it was learned, so it is not taught twice', async () => {
    await renderProbe(withSeen(null));
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('point');
    });

    await fireEvent.press(screen.getByTestId('spend'));

    await waitFor(() => {
      expect(writes).toStrictEqual([{ key: 'hint.letterTapSeenVersion', value: '1' }]);
    });
    expect(LETTER_HINT_KEY).toBe('hint.letterTapSeenVersion');
  });

  /**
   * ⚠️ Written even when the hint was never showing. Someone who found the
   * chips on their own has learned exactly what the pulse teaches; pointing at
   * it later would be the app explaining something back to a user who did it
   * unaided.
   */
  it('records a tap that happened without ever being prompted', async () => {
    await renderProbe(withSeen(String(LETTER_HINT_VERSION)));
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('quiet');
    });

    await fireEvent.press(screen.getByTestId('spend'));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });
  });
});
