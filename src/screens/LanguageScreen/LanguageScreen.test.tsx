import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { LanguageScreen } from './LanguageScreen';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { createFakePorts, type FakePorts } from '@/testing/fakePorts';

function show(ports: FakePorts = createFakePorts()) {
  const onBack = jest.fn();
  const view = renderWithProviders(<LanguageScreen onBack={onBack} />, { ports });
  return { ...view, onBack };
}

describe('the interface language', () => {
  // Endonyms, so a user who cannot read the current interface can still find
  // their own language in the list.
  it('lists each language in its own words', () => {
    show();
    expect(screen.getByTestId('interface-en')).toHaveTextContent(/English/u);
    expect(screen.getByTestId('interface-pt-BR')).toHaveTextContent(
      /Português \(Brasil\)/u,
    );
    expect(screen.getByTestId('interface-es')).toHaveTextContent(/Español/u);
  });

  it('also names each one in the language being read', () => {
    show();
    expect(screen.getByTestId('interface-pt-BR')).toHaveTextContent(
      /Brazilian Portuguese/u,
    );
  });

  it('marks the current one as selected, and only that one', () => {
    show();
    expect(screen.getByTestId('interface-en')).toBeSelected();
    expect(screen.getByTestId('interface-es')).not.toBeSelected();
  });

  it('switches the interface, which retranslates the screen around it', () => {
    show();
    fireEvent.press(screen.getByTestId('interface-es'));
    expect(screen.getByTestId('interface-es')).toBeSelected();
    expect(screen.getByText('RECONOCIMIENTO DE VOZ')).toBeOnTheScreen();
  });
});

/**
 * ⚠️ The interface language and the recogniser are INDEPENDENT.
 *
 * Recognition used to follow the interface unless a "Match the interface"
 * switch was turned off — so changing the app's language silently changed what
 * the microphone listened for, on a device that might not even have that
 * recogniser installed. These tests replace the ones that asserted the old
 * coupling; they are not a weakening of them.
 */
describe('the recogniser language', () => {
  it('offers the recognisers without hiding them behind a switch', () => {
    show();
    expect(screen.getByTestId('language-recogniser')).toBeTruthy();
    expect(screen.queryByTestId('speech-follows')).toBeNull();
  });

  it('picks a recogniser and stores it', async () => {
    const ports = createFakePorts();
    show(ports);
    fireEvent.press(screen.getByTestId('recogniser-pt-BR'));
    await waitFor(() => {
      expect(ports.calls.stored).toContainEqual({
        key: 'settings.speechLocale',
        value: 'pt-BR',
      });
    });
  });

  /**
   * ⚠️ The whole point. Changing what the buttons say must not change what the
   * microphone hears.
   */
  it('does not move when the interface language changes', async () => {
    const ports = createFakePorts();
    show(ports);
    fireEvent.press(screen.getByTestId('recogniser-es'));
    await waitFor(() => {
      expect(ports.calls.stored).toContainEqual({
        key: 'settings.speechLocale',
        value: 'es',
      });
    });

    fireEvent.press(screen.getByTestId('interface-pt-BR'));

    // Changing the interface wrote nothing further to the recogniser.
    const speechWrites = ports.calls.stored.filter(
      (entry) => entry.key === 'settings.speechLocale',
    );
    expect(speechWrites).toStrictEqual([{ key: 'settings.speechLocale', value: 'es' }]);
  });
});

describe('the screen itself', () => {
  it('explains that recognisers depend on the device', () => {
    show();
    expect(
      screen.getByText(/depends on what your device has installed/u),
    ).toBeOnTheScreen();
  });

  it('goes back', () => {
    const { onBack } = show();
    fireEvent.press(screen.getByTestId('language-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows no tab bar — it is reached from Settings, not the tabs', () => {
    show();
    expect(screen.queryByTestId('tab-translate')).toBeNull();
  });
});
