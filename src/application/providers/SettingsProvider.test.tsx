import React from 'react';
import { Text, Pressable } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PortsProvider } from './PortsProvider';
import { SettingsProvider, useSettings } from './SettingsProvider';
import { createFakePorts, type FakePorts } from '@/testing/fakePorts';

/** Shows every setting, and offers a way to change each one. */
function Probe(): React.JSX.Element {
  const {
    settings,
    ready,
    setTapUnitMs,
    setPlaybackWpm,
    setSpeakDecoded,
    setCrashReports,
  } = useSettings();
  return (
    <>
      <Text testID="ready">{String(ready)}</Text>
      <Text testID="cutoff">{String(settings.tapUnitMs)}</Text>
      <Text testID="wpm">{String(settings.playbackWpm)}</Text>
      <Text testID="speak">{String(settings.speakDecoded)}</Text>
      <Text testID="crash">{String(settings.crashReports)}</Text>
      <Pressable
        testID="set-cutoff"
        onPress={() => {
          setTapUnitMs(250);
        }}
      />
      <Pressable
        testID="set-cutoff-out-of-range"
        onPress={() => {
          setTapUnitMs(9000);
        }}
      />
      <Pressable
        testID="set-wpm"
        onPress={() => {
          setPlaybackWpm(15);
        }}
      />
      <Pressable
        testID="set-speak"
        onPress={() => {
          setSpeakDecoded(false);
        }}
      />
      <Pressable
        testID="set-crash"
        onPress={() => {
          setCrashReports(false);
        }}
      />
    </>
  );
}

function mount(ports: FakePorts) {
  render(
    <PortsProvider ports={ports}>
      <SettingsProvider>
        <Probe />
      </SettingsProvider>
    </PortsProvider>,
  );
}

/** A fake whose storage already holds values. */
function portsHolding(stored: Readonly<Record<string, string>>): FakePorts {
  const ports = createFakePorts();
  return {
    ...ports,
    preferences: {
      ...ports.preferences,
      read: async (key: string) => stored[key] ?? null,
    },
  };
}

async function settle(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId('ready')).toHaveTextContent('true');
  });
}

describe('SettingsProvider', () => {
  it('shows the defaults on a device that has stored nothing', async () => {
    mount(createFakePorts());
    await settle();
    expect(screen.getByTestId('cutoff')).toHaveTextContent('180');
    expect(screen.getByTestId('wpm')).toHaveTextContent('10');
    expect(screen.getByTestId('speak')).toHaveTextContent('true');
    expect(screen.getByTestId('crash')).toHaveTextContent('true');
  });

  it('restores what was stored', async () => {
    mount(
      portsHolding({
        'settings.tapUnitMs': '300',
        'settings.playbackWpm': '5',
        'settings.speakDecoded': 'false',
        'settings.crashReports': 'false',
      }),
    );
    await settle();
    expect(screen.getByTestId('cutoff')).toHaveTextContent('300');
    expect(screen.getByTestId('wpm')).toHaveTextContent('5');
    expect(screen.getByTestId('speak')).toHaveTextContent('false');
    expect(screen.getByTestId('crash')).toHaveTextContent('false');
  });

  // The defaults render before storage answers, so a screen that reads the
  // value must be able to tell "not asked yet" from "the user chose 180".
  it('is not ready until storage has answered', () => {
    mount(createFakePorts());
    expect(screen.getByTestId('ready')).toHaveTextContent('false');
  });

  it.each([
    ['set-cutoff', 'cutoff', '250', 'settings.tapUnitMs', '250'],
    ['set-wpm', 'wpm', '15', 'settings.playbackWpm', '15'],
    ['set-speak', 'speak', 'false', 'settings.speakDecoded', 'false'],
    ['set-crash', 'crash', 'false', 'settings.crashReports', 'false'],
  ])('%s changes the value and writes it', async (button, label, shown, key, written) => {
    const ports = createFakePorts();
    mount(ports);
    await settle();
    fireEvent.press(screen.getByTestId(button));
    expect(screen.getByTestId(label)).toHaveTextContent(shown);
    await waitFor(() => {
      expect(ports.calls.stored).toContainEqual({ key, value: written });
    });
  });

  it('holds a cut-off from a caller that computed one out of range', async () => {
    const ports = createFakePorts();
    mount(ports);
    await settle();
    fireEvent.press(screen.getByTestId('set-cutoff-out-of-range'));
    expect(screen.getByTestId('cutoff')).toHaveTextContent('400');
    await waitFor(() => {
      expect(ports.calls.stored).toContainEqual({
        key: 'settings.tapUnitMs',
        value: '400',
      });
    });
  });

  // Crashlytics reads its flag at launch, so telling it now is what makes a
  // user who opts out and force-quits actually opted out.
  it('tells the crash reporter as well as storage', async () => {
    const ports = createFakePorts();
    mount(ports);
    await settle();
    fireEvent.press(screen.getByTestId('set-crash'));
    await waitFor(() => {
      expect(ports.calls.crashCollection).toStrictEqual([false]);
    });
  });

  it('refuses to be used outside the provider', () => {
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow('useSettings must be used inside');
    quiet.mockRestore();
  });
});
