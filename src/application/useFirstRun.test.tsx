import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import { FIRST_RUN_KEY, FIRST_RUN_VERSION } from '@/core/domain/firstRun';
import type { Ports } from '@/core/ports';
import { createFakePorts, type FakePorts } from '@/testing/fakePorts';
import { PortsProvider } from './providers/PortsProvider';
import { useFirstRun } from './useFirstRun';

function Probe(): React.JSX.Element {
  const { ready, show, dismiss } = useFirstRun();
  return (
    <>
      <Text testID="state">{`${ready ? 'ready' : 'reading'}:${show ? 'show' : 'hide'}`}</Text>
      <Text testID="dismiss" onPress={dismiss}>
        done
      </Text>
    </>
  );
}

const withSeen = (seen: string | null): FakePorts => {
  const preferences: Ports['preferences'] = {
    read: async () => seen,
    write: async () => undefined,
  };
  return createFakePorts({ preferences });
};

const renderProbe = (ports: FakePorts): void => {
  render(
    <PortsProvider ports={ports}>
      <Probe />
    </PortsProvider>,
  );
};

describe('useFirstRun', () => {
  // Showing the Translator for a frame and then covering it is worse than a
  // beat of empty ground.
  it('reports nothing until the stored answer is in', () => {
    renderProbe(withSeen(null));
    expect(screen.getByTestId('state')).toHaveTextContent('reading:hide');
  });

  it('shows the guide on a fresh install', async () => {
    renderProbe(withSeen(null));
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('ready:show');
    });
  });

  it('leaves someone alone who has seen this version', async () => {
    renderProbe(withSeen(String(FIRST_RUN_VERSION)));
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('ready:hide');
    });
  });

  it('shows it again to someone who only saw an older version', async () => {
    renderProbe(withSeen('0'));
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('ready:show');
    });
  });

  it('remembers the version once it is dismissed', async () => {
    const ports = createFakePorts();
    renderProbe(ports);
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('ready:show');
    });

    screen.getByTestId('dismiss').props.onPress();

    await waitFor(() => {
      expect(ports.calls.stored).toEqual([
        { key: FIRST_RUN_KEY, value: String(FIRST_RUN_VERSION) },
      ]);
    });
    expect(screen.getByTestId('state')).toHaveTextContent('ready:hide');
  });
});
