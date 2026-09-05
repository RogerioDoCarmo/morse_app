import React from 'react';
import { screen } from '@testing-library/react-native';
import { LearnScreen } from './LearnScreen';
import { renderWithProviders } from '@/testing/renderWithProviders';

let mockWidth = 1180;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 820, scale: 2, fontScale: 1 }),
}));

const show = (): void => {
  renderWithProviders(<LearnScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
};

describe('Learn on a tablet', () => {
  beforeEach(() => {
    mockWidth = 1180;
  });

  it('stands the alphabet beside the prose', () => {
    show();
    expect(screen.getByTestId('learn-columns')).toBeOnTheScreen();
  });

  it('navigates from the rail rather than a bottom bar', () => {
    show();
    expect(screen.getByTestId('nav-rail')).toBeOnTheScreen();
    expect(screen.queryByTestId('tab-bar')).toBeNull();
  });

  // Two columns are a different ORDER, not different content: everything the
  // phone shows is still here, and still only once.
  it('shows every section exactly once', () => {
    show();
    expect(screen.getByTestId('learn-what')).toBeOnTheScreen();
    expect(screen.getByTestId('learn-alphabet')).toBeOnTheScreen();
    expect(screen.getByTestId('learn-gaps')).toBeOnTheScreen();
    expect(screen.getByTestId('learn-tips')).toBeOnTheScreen();
    expect(screen.getAllByTestId('learn-letter')).toHaveLength(39);
  });

  it('goes back to one column below the breakpoint', () => {
    mockWidth = 767;
    show();
    expect(screen.queryByTestId('learn-columns')).toBeNull();
    expect(screen.getByTestId('learn-alphabet')).toBeOnTheScreen();
  });
});
