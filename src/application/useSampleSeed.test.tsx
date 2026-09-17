import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SAMPLE_SEED_KEY, SAMPLE_SEED_VERSION } from '@/core/domain/sampleSeed';
import type { Ports } from '@/core/ports';
import { createFakePorts, type FakePorts } from '@/testing/fakePorts';
import { PortsProvider } from './providers/PortsProvider';
import { useSampleSeed } from './useSampleSeed';

function Probe(): React.JSX.Element {
  const { seed, spend } = useSampleSeed();
  return (
    <>
      <Text testID="state">{seed === null ? 'unknown' : seed ? 'seed' : 'empty'}</Text>
      <Text testID="spend" onPress={spend}>
        seeded
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

const mount = (seen: string | null): void => {
  render(
    <PortsProvider ports={withSeen(seen)}>
      <Probe />
    </PortsProvider>,
  );
};

beforeEach(() => {
  writes.length = 0;
});

describe('useSampleSeed', () => {
  /**
   * ⚠️ Three-state, and the unknown beat is the point. The shell holds the app
   * on a blank ground until this answers — a field that started empty and
   * filled a beat later would drop the sample INTO a message someone had
   * already begun typing.
   */
  it('answers nothing until storage has been read', () => {
    mount(null);
    expect(screen.getByTestId('state')).toHaveTextContent('unknown');
  });

  it('seeds on a device that has never been seeded', async () => {
    mount(null);
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('seed');
    });
  });

  it('does not seed a device that has already seen this version', async () => {
    mount(String(SAMPLE_SEED_VERSION));
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('empty');
    });
  });

  it('writes the version it has now shown', async () => {
    mount(null);
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('seed');
    });

    fireEvent.press(screen.getByTestId('spend'));

    await waitFor(() => {
      expect(writes).toEqual([{ key: SAMPLE_SEED_KEY, value: '1' }]);
    });
  });

  /**
   * ⚠️ THE ONE THAT KEEPS THE SAMPLE ON SCREEN. The shell unmounts a screen on
   * every tab change, so an answer that turned false the moment it was spent
   * would take the sample away on the way back from Speak. Storage remembers
   * for the next launch; within this one the answer must not move.
   */
  it('still says seed after spending, so the sample survives a tab change', async () => {
    mount(null);
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('seed');
    });

    fireEvent.press(screen.getByTestId('spend'));

    expect(screen.getByTestId('state')).toHaveTextContent('seed');
  });
});
