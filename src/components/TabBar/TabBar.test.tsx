import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { TabBar } from './TabBar';

describe('TabBar', () => {
  it('marks only the active destination as selected', () => {
    renderWithProviders(<TabBar active="tap" />);
    expect(screen.getByTestId('tab-tap')).toBeSelected();
    expect(screen.getByTestId('tab-translate')).not.toBeSelected();
  });

  it('reports the destination that was pressed', () => {
    const onSelect = jest.fn();
    renderWithProviders(<TabBar active="translate" onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId('tab-learn'));
    expect(onSelect).toHaveBeenCalledWith('learn');
  });

  it('survives having no handler', () => {
    renderWithProviders(<TabBar active="translate" />);
    expect(() => {
      fireEvent.press(screen.getByTestId('tab-speak'));
    }).not.toThrow();
  });

  it('labels the destinations in the active locale', () => {
    renderWithProviders(<TabBar active="translate" />, { locale: 'pt-BR' });
    expect(screen.getByText('Traduzir')).toBeOnTheScreen();
    expect(screen.getByText('Aprender')).toBeOnTheScreen();
  });

  it('translates the destinations for Spanish too', () => {
    renderWithProviders(<TabBar active="translate" />, { locale: 'es' });
    expect(screen.getByText('Traducir')).toBeOnTheScreen();
    expect(screen.getByText('Pulsar')).toBeOnTheScreen();
  });

  it('renders a glyph for every destination', () => {
    renderWithProviders(<TabBar active="translate" />);
    for (const glyph of ['icon-translate', 'icon-mic', 'icon-tap', 'icon-book']) {
      expect(screen.getByTestId(glyph)).toBeOnTheScreen();
    }
  });
});
