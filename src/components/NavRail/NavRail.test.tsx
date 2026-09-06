import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { NavRail } from './NavRail';
import { TABS } from '@/components/TabBar';
import { renderWithProviders } from '@/testing/renderWithProviders';

describe('NavRail', () => {
  // Sharing TABS with the bar is the point: a rail that could list different
  // destinations would be a bug waiting to happen.
  it('lists exactly the destinations the tab bar lists', () => {
    renderWithProviders(<NavRail active="translate" />);
    expect(TABS.map((tab) => tab.name)).toStrictEqual([
      'translate',
      'speak',
      'tap',
      'learn',
    ]);
    for (const tab of TABS) {
      expect(screen.getByTestId(`tab-${tab.name}`)).toBeOnTheScreen();
    }
  });

  it('marks the current destination, and only that one', () => {
    renderWithProviders(<NavRail active="tap" />);
    expect(screen.getByTestId('tab-tap')).toBeSelected();
    expect(screen.getByTestId('tab-learn')).not.toBeSelected();
  });

  it('navigates', () => {
    const onSelect = jest.fn();
    renderWithProviders(<NavRail active="translate" onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId('tab-speak'));
    expect(onSelect).toHaveBeenCalledWith('speak');
  });

  it('greys an unbuilt destination and answers no press', () => {
    const onSelect = jest.fn();
    renderWithProviders(
      <NavRail active="translate" onSelect={onSelect} unavailable={['learn']} />,
    );
    expect(screen.getByTestId('tab-learn')).toBeDisabled();
    fireEvent.press(screen.getByTestId('tab-learn'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('carries no gear unless given somewhere for it to go', () => {
    renderWithProviders(<NavRail active="translate" />);
    expect(screen.queryByTestId('open-settings')).toBeNull();
  });
});
