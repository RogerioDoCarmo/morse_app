import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { TabBar } from './TabBar';

describe('TabBar', () => {
  it('marks only the active destination as selected', async () => {
    await renderWithProviders(<TabBar active="tap" />);
    expect(screen.getByTestId('tab-tap')).toBeSelected();
    expect(screen.getByTestId('tab-translate')).not.toBeSelected();
  });

  it('reports the destination that was pressed', async () => {
    const onSelect = jest.fn();
    await renderWithProviders(<TabBar active="translate" onSelect={onSelect} />);
    await fireEvent.press(screen.getByTestId('tab-learn'));
    expect(onSelect).toHaveBeenCalledWith('learn');
  });

  it('survives having no handler', async () => {
    await renderWithProviders(<TabBar active="translate" />);
    await expect(
      fireEvent.press(screen.getByTestId('tab-speak')),
    ).resolves.toBeUndefined();
  });

  it('labels the destinations in the active locale', async () => {
    await renderWithProviders(<TabBar active="translate" />, { locale: 'pt-BR' });
    expect(screen.getByText('Traduzir')).toBeOnTheScreen();
    expect(screen.getByText('Aprender')).toBeOnTheScreen();
  });

  it('translates the destinations for Spanish too', async () => {
    await renderWithProviders(<TabBar active="translate" />, { locale: 'es' });
    expect(screen.getByText('Traducir')).toBeOnTheScreen();
    expect(screen.getByText('Pulsar')).toBeOnTheScreen();
  });

  it('renders a glyph for every destination', async () => {
    await renderWithProviders(<TabBar active="translate" />);
    for (const glyph of ['icon-translate', 'icon-mic', 'icon-tap', 'icon-book']) {
      expect(screen.getByTestId(glyph)).toBeOnTheScreen();
    }
  });
});

describe('TabBar — destinations that do not exist yet', () => {
  it('still shows them, so the bar does not move as screens land', async () => {
    await renderWithProviders(
      <TabBar active="translate" unavailable={['tap', 'learn']} />,
    );
    expect(screen.getByTestId('tab-tap')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-learn')).toBeOnTheScreen();
  });

  it('greys them out rather than answering a press with nothing', async () => {
    const onSelect = jest.fn();
    await renderWithProviders(
      <TabBar active="translate" onSelect={onSelect} unavailable={['learn']} />,
    );

    expect(screen.getByTestId('tab-learn')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('tab-learn'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('leaves the reachable ones alone', async () => {
    const onSelect = jest.fn();
    await renderWithProviders(
      <TabBar active="translate" onSelect={onSelect} unavailable={['learn']} />,
    );

    expect(screen.getByTestId('tab-speak')).not.toBeDisabled();
    await fireEvent.press(screen.getByTestId('tab-speak'));
    expect(onSelect).toHaveBeenCalledWith('speak');
  });
});
