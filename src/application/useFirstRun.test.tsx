import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { FIRST_RUN_KEY, FIRST_RUN_VERSION } from '@/core/domain/firstRun';
import type { Ports } from '@/core/ports';
import { createFakePorts, type FakePorts } from '@/testing/fakePorts';
import { PortsProvider } from './providers/PortsProvider';
import { useFirstRun } from './useFirstRun';

function Probe(): React.JSX.Element {
  const { ready, show, dismiss, replay } = useFirstRun();
  return (
    <>
      <Text testID="state">{`${ready ? 'ready' : 'reading'}:${show ? 'show' : 'hide'}`}</Text>
      <Text testID="dismiss" onPress={dismiss}>
        done
      </Text>
      <Text testID="replay" onPress={replay}>
        again
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

describe('showing the guide again on request', () => {
  /** A device that has already been shown the current guide. */
  const seenIt = (): FakePorts => createFakePorts();

  const settle = async (): Promise<void> => {
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent(/^ready:/u);
    });
  };

  // The version gate answers "has this device seen THIS guide", which is right
  // for showing it unasked and wrong for a user who tapped Skip: they have
  // seen it and still want it back.
  it('brings the guide back after it has been dismissed', async () => {
    const ports = seenIt();
    renderProbe(ports);
    await settle();
    fireEvent.press(screen.getByTestId('dismiss'));
    expect(screen.getByTestId('state')).toHaveTextContent('ready:hide');

    fireEvent.press(screen.getByTestId('replay'));
    expect(screen.getByTestId('state')).toHaveTextContent('ready:show');
  });

  // Asking to see it again must not make the app think it was never shown.
  it('stores nothing, so the automatic gate is left as it was', async () => {
    const ports = seenIt();
    renderProbe(ports);
    await settle();
    fireEvent.press(screen.getByTestId('dismiss'));
    const written = ports.calls.stored.length;

    fireEvent.press(screen.getByTestId('replay'));
    expect(ports.calls.stored).toHaveLength(written);
  });

  it('can be put away again the ordinary way', async () => {
    const ports = seenIt();
    renderProbe(ports);
    await settle();
    fireEvent.press(screen.getByTestId('replay'));
    expect(screen.getByTestId('state')).toHaveTextContent('ready:show');

    fireEvent.press(screen.getByTestId('dismiss'));
    expect(screen.getByTestId('state')).toHaveTextContent('ready:hide');
    await waitFor(() => {
      expect(ports.calls.stored).toContainEqual({
        key: FIRST_RUN_KEY,
        value: String(FIRST_RUN_VERSION),
      });
    });
  });
});
