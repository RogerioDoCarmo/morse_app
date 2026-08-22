import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { TranslatorScreen } from './TranslatorScreen';

describe('TranslatorScreen', () => {
  it('encodes what is typed', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');
    expect(screen.getByTestId('morse-string')).toHaveTextContent('... --- ...');
  });

  it('re-encodes as the text changes', () => {
    renderWithProviders(<TranslatorScreen />);
    const input = screen.getByTestId('translator-input');
    fireEvent.changeText(input, 'E');
    expect(screen.getByTestId('morse-string')).toHaveTextContent('.');
    fireEvent.changeText(input, 'T');
    expect(screen.getByTestId('morse-string')).toHaveTextContent('-');
  });

  it('encodes accented input by the rule the domain settled on', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'AÇÃO');
    expect(screen.getByTestId('morse-string')).toHaveTextContent('.- -.-.. .- ---');
  });

  it('drives the torch through the port, not a library', async () => {
    const { ports } = renderWithProviders(<TranslatorScreen />);
    fireEvent.press(screen.getByTestId('flash-button'));
    await waitFor(() => {
      expect(ports.calls.torchEnabled).toEqual([true]);
    });
  });

  it('turns the torch back off on a second press', async () => {
    const { ports } = renderWithProviders(<TranslatorScreen />);
    fireEvent.press(screen.getByTestId('flash-button'));
    await waitFor(() => {
      expect(ports.calls.torchEnabled).toEqual([true]);
    });
    fireEvent.press(screen.getByTestId('flash-button'));
    await waitFor(() => {
      expect(ports.calls.torchEnabled).toEqual([true, false]);
    });
  });

  it('renders in the selected locale', () => {
    renderWithProviders(<TranslatorScreen />, { locale: 'es' });
    expect(screen.getByText('Destellar')).toBeOnTheScreen();
  });
});
