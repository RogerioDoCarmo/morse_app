import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { SettingsScreen } from './SettingsScreen';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { createFakePorts, type FakePorts } from '@/testing/fakePorts';

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

function show(ports: FakePorts = createFakePorts()) {
  const onBack = jest.fn();
  const onOpenLearn = jest.fn();
  const onOpenLanguage = jest.fn();
  const view = renderWithProviders(
    <SettingsScreen
      onBack={onBack}
      onOpenLearn={onOpenLearn}
      onOpenLanguage={onOpenLanguage}
    />,
    { ports },
  );
  return { ...view, onBack, onOpenLearn, onOpenLanguage };
}

describe('SettingsScreen', () => {
  it('shows every section the design calls for', () => {
    show();
    expect(screen.getByText('TAP INPUT')).toBeOnTheScreen();
    expect(screen.getByText('LANGUAGE')).toBeOnTheScreen();
    expect(screen.getByText('OUTPUT')).toBeOnTheScreen();
    expect(screen.getByText('PRIVACY')).toBeOnTheScreen();
    expect(screen.getByText('ABOUT')).toBeOnTheScreen();
  });

  it('shows the cut-off in milliseconds, with the ends of the range', () => {
    show();
    expect(screen.getByTestId('settings-cutoff-value')).toHaveTextContent('180 ms');
    expect(screen.getByText('80')).toBeOnTheScreen();
    expect(screen.getByText('400')).toBeOnTheScreen();
  });

  it('moves the cut-off and writes it', async () => {
    const ports = createFakePorts();
    show(ports);
    const slider = screen.getByTestId('settings-cutoff');
    fireEvent(slider, 'layout', {
      nativeEvent: { layout: { width: 320, height: 34, x: 0, y: 0 } },
    });
    fireEvent(slider, 'responderGrant', {
      nativeEvent: { locationX: 320 },
      touchHistory: { touchBank: [] },
    });
    expect(screen.getByTestId('settings-cutoff-value')).toHaveTextContent('400 ms');
    await waitFor(() => {
      expect(ports.calls.stored).toContainEqual({
        key: 'settings.tapUnitMs',
        value: '400',
      });
    });
  });

  it('offers the three speeds and stores the one picked', async () => {
    const ports = createFakePorts();
    show(ports);
    expect(screen.getByText('5 WPM')).toBeOnTheScreen();
    expect(screen.getByText('15 WPM')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('segment-15'));
    await waitFor(() => {
      expect(ports.calls.stored).toContainEqual({
        key: 'settings.playbackWpm',
        value: '15',
      });
    });
  });

  // Settings shows what each locale currently is and hands the choosing to
  // the Language screen — one owner per value.
  it('shows the current languages without offering to change them here', () => {
    show();
    expect(screen.getByTestId('settings-language')).toHaveTextContent(/English/u);
    expect(screen.getByTestId('settings-speech-locale')).toHaveTextContent(/English/u);
  });

  it('shows the recogniser language when it no longer follows the interface', () => {
    show(portsHolding({ 'settings.speechLocale': 'es' }));
    return waitFor(() => {
      expect(screen.getByTestId('settings-speech-locale')).toHaveTextContent(/Español/u);
    });
  });

  it.each(['settings-language', 'settings-speech-locale'])(
    '%s opens the Language screen',
    (testID) => {
      const { onOpenLanguage } = show();
      fireEvent.press(screen.getByTestId(testID));
      expect(onOpenLanguage).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['settings-read-aloud', 'settings.speakDecoded'],
    ['settings-crash-reports', 'settings.crashReports'],
  ])('turns %s off and writes it', async (testID, key) => {
    const ports = createFakePorts();
    show(ports);
    fireEvent(screen.getByTestId(testID), 'valueChange', false);
    await waitFor(() => {
      expect(ports.calls.stored).toContainEqual({ key, value: 'false' });
    });
  });

  it('opts out of crash reporting with the reporter itself, not just storage', async () => {
    const ports = createFakePorts();
    show(ports);
    fireEvent(screen.getByTestId('settings-crash-reports'), 'valueChange', false);
    await waitFor(() => {
      expect(ports.calls.crashCollection).toStrictEqual([false]);
    });
  });

  it('goes back', () => {
    const { onBack } = show();
    fireEvent.press(screen.getByTestId('settings-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('sends the About row to Learn, which already answers it', () => {
    const { onOpenLearn } = show();
    fireEvent.press(screen.getByTestId('settings-about-morse'));
    expect(onOpenLearn).toHaveBeenCalledTimes(1);
  });

  // Settings is reached from the gear and left by the arrow, so it sits above
  // the tabs rather than beside them.
  it('shows no tab bar', () => {
    show();
    expect(screen.queryByTestId('tab-translate')).toBeNull();
  });
});
