import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { FirstRunScreen } from './FirstRunScreen';
import { renderWithProviders } from '@/testing/renderWithProviders';

let mockWidth = 1180;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 820, scale: 2, fontScale: 1 }),
}));

function show(onDone = jest.fn()) {
  renderWithProviders(<FirstRunScreen onDone={onDone} />);
  return onDone;
}

describe('the carousel on a tablet', () => {
  beforeEach(() => {
    mockWidth = 1180;
  });

  // Everything the phone shows is still here: a wider window is not a
  // different guide.
  it('shows the illustration, the copy, the dots and the way on', () => {
    show();
    expect(screen.getByTestId('first-run-art-chips')).toBeOnTheScreen();
    expect(screen.getByTestId('first-run-chips')).toBeOnTheScreen();
    expect(screen.getByTestId('first-run-dots')).toBeOnTheScreen();
    expect(screen.getByTestId('first-run-next')).toBeOnTheScreen();
  });

  it('still walks all three slides and lands on Start', () => {
    show();
    expect(screen.getByTestId('first-run-art-chips')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('first-run-next'));
    expect(screen.getByTestId('first-run-art-channels')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('first-run-next'));
    expect(screen.getByTestId('first-run-art-letter')).toBeOnTheScreen();
    expect(screen.queryByTestId('first-run-skip')).toBeNull();
  });

  it('still leaves only by Start', () => {
    const onDone = show();
    fireEvent.press(screen.getByTestId('first-run-skip'));
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('first-run-next'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  // The dots line up with the copy they are pacing rather than centring under
  // a column that is only half the screen.
  it('lines the dots up with the copy', () => {
    show();
    const dots = screen.getByTestId('first-run-dots').props.style as readonly unknown[];
    expect(JSON.stringify(dots)).toContain('flex-start');
  });

  it('centres the dots again on a phone', () => {
    mockWidth = 402;
    show();
    const dots = screen.getByTestId('first-run-dots').props.style as readonly unknown[];
    expect(JSON.stringify(dots)).not.toContain('flex-start');
  });

  // Slide two's illustration is a four-cell strip, not a fluid grid. Half of
  // an iPad in portrait is about 313pt, narrower than the phone it was drawn
  // for, so that width keeps one column rather than cramping it.
  it('keeps one column on a tablet in portrait', () => {
    mockWidth = 834;
    show();
    const dots = screen.getByTestId('first-run-dots').props.style as readonly unknown[];
    expect(JSON.stringify(dots)).not.toContain('flex-start');
  });

  it('still caps the measure there rather than stretching the phone layout', () => {
    mockWidth = 834;
    show();
    expect(JSON.stringify(screen.getByTestId('first-run').props.style)).toContain('620');
  });

  it('does not cap the two-column layout, which needs the width', () => {
    show();
    expect(JSON.stringify(screen.getByTestId('first-run').props.style)).not.toContain(
      '620',
    );
  });
});
