import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { TipsScreen } from './TipsScreen';

describe('TipsScreen', () => {
  it('carries the five that work', () => {
    renderWithProviders(<TipsScreen onBack={jest.fn()} />);
    for (const n of [1, 2, 3, 4, 5]) {
      expect(screen.getByTestId(`tip-${String(n)}`)).toBeOnTheScreen();
    }
  });

  // Set apart from the numbered five so it is not skimmed as a sixth thing to
  // do — it is the habit to avoid.
  it('sets the one to avoid apart from them', () => {
    renderWithProviders(<TipsScreen onBack={jest.fn()} />);
    expect(screen.getByTestId('tip-avoid')).toBeOnTheScreen();
    expect(screen.queryByTestId('tip-6')).toBeNull();
    expect(screen.getByText("Don't count the dots")).toBeOnTheScreen();
  });

  it('numbers the five in order', () => {
    renderWithProviders(<TipsScreen onBack={jest.fn()} />);
    expect(screen.getByText('Learn the sound, not the picture')).toBeOnTheScreen();
    expect(screen.getByText('Send as well as receive')).toBeOnTheScreen();
  });

  it('goes back when asked', () => {
    const onBack = jest.fn();
    renderWithProviders(<TipsScreen onBack={onBack} />);

    fireEvent.press(screen.getByTestId('tips-back'));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('speaks the interface language', () => {
    renderWithProviders(<TipsScreen onBack={jest.fn()} />, { locale: 'es' });
    expect(screen.getByText('Consejos')).toBeOnTheScreen();
    expect(screen.getByText('No cuentes los puntos')).toBeOnTheScreen();
  });
});
