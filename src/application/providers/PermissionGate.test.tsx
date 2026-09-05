import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { LocaleProvider } from './LocaleProvider';
import { PermissionGate, usePermissionGate } from './PermissionGate';
import { PortsProvider } from './PortsProvider';
import type { PermissionState } from '@/core/domain/permission';
import { createFakePorts, type FakePorts } from '@/testing/fakePorts';

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Asks for the torch on demand and shows what the gate answered. */
function Probe(): React.JSX.Element {
  const { ensure } = usePermissionGate();
  const [answer, setAnswer] = useState<string>('unasked');
  return (
    <>
      <Text testID="answer">{answer}</Text>
      <Text testID="behind">still here</Text>
      <Pressable
        testID="ask"
        onPress={() => {
          void ensure('camera').then((granted) => {
            setAnswer(String(granted));
          });
        }}
      />
    </>
  );
}

function mount(ports: FakePorts) {
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <PortsProvider ports={ports}>
        <LocaleProvider initialLocale="en">
          <PermissionGate>
            <Probe />
          </PermissionGate>
        </LocaleProvider>
      </PortsProvider>
    </SafeAreaProvider>,
  );
}

/** A fake whose permission answers are scripted. */
function portsAnswering(
  initial: PermissionState,
  afterRequest: PermissionState = { granted: true, canAskAgain: false },
): FakePorts {
  const ports = createFakePorts({}, initial);
  return {
    ...ports,
    permission: {
      ...ports.permission,
      request: async (kind) => {
        ports.calls.requested.push(kind);
        return afterRequest;
      },
    },
  };
}

const UNASKED: PermissionState = { granted: false, canAskAgain: true };
const BLOCKED: PermissionState = { granted: false, canAskAgain: false };

describe('when the permission is already held', () => {
  // No rationale, no prompt, nothing on screen: the gate is invisible in the
  // case that will be the common one after first use.
  it('answers yes without showing anything', async () => {
    const ports = portsAnswering({ granted: true, canAskAgain: false });
    mount(ports);
    fireEvent.press(screen.getByTestId('ask'));
    await waitFor(() => {
      expect(screen.getByTestId('answer')).toHaveTextContent('true');
    });
    expect(screen.queryByTestId('permission-camera')).toBeNull();
    expect(ports.calls.requested).toEqual([]);
  });
});

describe('when the permission has not been asked for', () => {
  it('shows the rationale before prompting the OS', async () => {
    const ports = portsAnswering(UNASKED);
    mount(ports);
    fireEvent.press(screen.getByTestId('ask'));
    await waitFor(() => {
      expect(screen.getByTestId('permission-camera')).toBeOnTheScreen();
    });
    // The OS has not been asked yet — that is the entire point.
    expect(ports.calls.requested).toEqual([]);
  });

  // A user asked for the torch mid-message should still have the message.
  it('covers the app without unmounting it', async () => {
    mount(portsAnswering(UNASKED));
    fireEvent.press(screen.getByTestId('ask'));
    await waitFor(() => {
      expect(screen.getByTestId('permission-camera')).toBeOnTheScreen();
    });
    expect(screen.getByTestId('behind')).toBeOnTheScreen();
  });

  it('prompts on allow, and answers yes once granted', async () => {
    const ports = portsAnswering(UNASKED);
    mount(ports);
    fireEvent.press(screen.getByTestId('ask'));
    await waitFor(() => {
      expect(screen.getByTestId('permission-camera')).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByTestId('permission-primary'));
    await waitFor(() => {
      expect(screen.getByTestId('answer')).toHaveTextContent('true');
    });
    expect(ports.calls.requested).toEqual(['camera']);
    expect(screen.queryByTestId('permission-camera')).toBeNull();
  });

  it('answers no on Not now, without ever prompting', async () => {
    const ports = portsAnswering(UNASKED);
    mount(ports);
    fireEvent.press(screen.getByTestId('ask'));
    await waitFor(() => {
      expect(screen.getByTestId('permission-camera')).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByTestId('permission-dismiss'));
    await waitFor(() => {
      expect(screen.getByTestId('answer')).toHaveTextContent('false');
    });
    expect(ports.calls.requested).toEqual([]);
  });

  // Denying with asks left is an ordinary no: the screen closes and the app
  // carries on, and the next attempt may ask again.
  it('answers no when the OS prompt is denied but may be shown again', async () => {
    mount(portsAnswering(UNASKED, UNASKED));
    fireEvent.press(screen.getByTestId('ask'));
    await waitFor(() => {
      expect(screen.getByTestId('permission-camera')).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByTestId('permission-primary'));
    await waitFor(() => {
      expect(screen.getByTestId('answer')).toHaveTextContent('false');
    });
  });

  // The one case worth the extra state: the way forward has changed, so the
  // screen changes rather than closing and leaving the user to guess.
  it('turns into the blocked screen when that denial was the last ask', async () => {
    mount(portsAnswering(UNASKED, BLOCKED));
    fireEvent.press(screen.getByTestId('ask'));
    await waitFor(() => {
      expect(screen.getByTestId('permission-headline')).toHaveTextContent(
        'Morse needs the torch',
      );
    });
    fireEvent.press(screen.getByTestId('permission-primary'));
    await waitFor(() => {
      expect(screen.getByTestId('permission-headline')).toHaveTextContent(
        'Camera access is off',
      );
    });
    expect(screen.getByTestId('answer')).toHaveTextContent('unasked');
  });
});

describe('when the permission is blocked', () => {
  it('opens the blocked screen straight away, with no prompt offered', async () => {
    const ports = portsAnswering(BLOCKED);
    mount(ports);
    fireEvent.press(screen.getByTestId('ask'));
    await waitFor(() => {
      expect(screen.getByTestId('permission-primary')).toHaveTextContent('Open Settings');
    });
    expect(ports.calls.requested).toEqual([]);
  });

  it('opens the system settings and answers no, since the answer is elsewhere', async () => {
    const ports = portsAnswering(BLOCKED);
    mount(ports);
    fireEvent.press(screen.getByTestId('ask'));
    await waitFor(() => {
      expect(screen.getByTestId('permission-camera')).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByTestId('permission-primary'));
    await waitFor(() => {
      expect(screen.getByTestId('answer')).toHaveTextContent('false');
    });
    expect(ports.calls.settingsOpened).toBe(1);
  });
});

describe('the gate itself', () => {
  it('refuses to be used outside the provider', () => {
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow('usePermissionGate must be used inside');
    quiet.mockRestore();
  });
});
