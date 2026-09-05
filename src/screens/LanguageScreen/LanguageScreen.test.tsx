import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { LanguageScreen } from './LanguageScreen';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { createFakePorts, type FakePorts } from '@/testing/fakePorts';

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

describe('the recogniser language', () => {
  it('follows the interface until told otherwise', () => {
    show();
    expect(screen.getByTestId('speech-follows').props.value).toBe(true);
    expect(screen.queryByTestId('language-recogniser')).toBeNull();
  });

  it('names the language it will listen for while it follows', () => {
    show();
    expect(screen.getByText('Recognise speech in English')).toBeOnTheScreen();
  });

  it('offers the recognisers once it stops following', () => {
    show();
    fireEvent(screen.getByTestId('speech-follows'), 'valueChange', false);
    expect(screen.getByTestId('language-recogniser')).toBeOnTheScreen();
    expect(screen.getByTestId('recogniser-en')).toHaveTextContent(/English \(US\)/u);
  });

  // Turning the switch off must not silently change which language is heard.
  it('starts from the interface language rather than jumping elsewhere', async () => {
    const ports = createFakePorts();
    show(ports);
    fireEvent(screen.getByTestId('speech-follows'), 'valueChange', false);
    expect(screen.getByTestId('recogniser-en')).toBeSelected();
    await waitFor(() => {
      expect(ports.calls.stored).toContainEqual({
        key: 'settings.speechLocale',
        value: 'en',
      });
    });
  });

  it('picks a different recogniser and stores it', async () => {
    const ports = createFakePorts();
    show(ports);
    fireEvent(screen.getByTestId('speech-follows'), 'valueChange', false);
    fireEvent.press(screen.getByTestId('recogniser-es'));
    expect(screen.getByTestId('recogniser-es')).toBeSelected();
    await waitFor(() => {
      expect(ports.calls.stored).toContainEqual({
        key: 'settings.speechLocale',
        value: 'es',
      });
    });
  });

  it('restores a stored recogniser, switch already off', async () => {
    show(portsHolding({ 'settings.speechLocale': 'pt-BR' }));
    await waitFor(() => {
      expect(screen.getByTestId('speech-follows').props.value).toBe(false);
    });
    expect(screen.getByTestId('recogniser-pt-BR')).toBeSelected();
  });

  // 'follow' is the sentinel the port writes, since it cannot delete a key.
  it('goes back to following, and says so in storage', async () => {
    const ports = portsHolding({ 'settings.speechLocale': 'es' });
    show(ports);
    await waitFor(() => {
      expect(screen.getByTestId('speech-follows').props.value).toBe(false);
    });
    fireEvent(screen.getByTestId('speech-follows'), 'valueChange', true);
    expect(screen.queryByTestId('language-recogniser')).toBeNull();
    await waitFor(() => {
      expect(ports.calls.stored).toContainEqual({
        key: 'settings.speechLocale',
        value: 'follow',
      });
    });
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
