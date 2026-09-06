import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { TranslatorScreen } from './TranslatorScreen';
import { renderWithProviders } from '@/testing/renderWithProviders';

let mockWidth = 1180;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 820, scale: 2, fontScale: 1 }),
}));

describe('the Translator on a tablet', () => {
  beforeEach(() => {
    mockWidth = 1180;
  });

  it('navigates from the rail rather than a bottom bar', () => {
    renderWithProviders(<TranslatorScreen />);
    expect(screen.getByTestId('nav-rail')).toBeOnTheScreen();
    expect(screen.queryByTestId('tab-bar')).toBeNull();
  });

  // Two gears would be one too many, and the rail's is the one always in
  // reach — the header scrolls out of the way, the rail does not.
  it('puts the only gear on the rail', () => {
    const onOpenSettings = jest.fn();
    renderWithProviders(<TranslatorScreen onOpenSettings={onOpenSettings} />);
    expect(screen.getAllByTestId('open-settings')).toHaveLength(1);
    fireEvent.press(screen.getByTestId('open-settings'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('keeps the gear in the header on a phone', () => {
    mockWidth = 402;
    const onOpenSettings = jest.fn();
    renderWithProviders(<TranslatorScreen onOpenSettings={onOpenSettings} />);
    expect(screen.getAllByTestId('open-settings')).toHaveLength(1);
    fireEvent.press(screen.getByTestId('open-settings'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  // Everything the phone does still works; a wider window is not a different
  // app, and the encoding is the whole point of the screen.
  it('still translates', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');
    expect(screen.getByTestId('morse-string')).toHaveTextContent('... --- ...');
  });

  it('still carries the output channels and the signal button', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'E');
    expect(screen.getByTestId('channel-sound')).toBeOnTheScreen();
    expect(screen.getByTestId('signal-button')).toBeOnTheScreen();
  });
});
