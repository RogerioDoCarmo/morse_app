import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { encode } from '@/core/domain/morse';
import { MorseText } from './MorseText';

describe('MorseText', () => {
  it('renders one labelled cell per letter', () => {
    render(<MorseText message={encode('SOS')} />);
    expect(screen.getAllByText(/^[SO]$/u)).toHaveLength(3);
  });

  it('is findable by a stable, locale-independent label', () => {
    render(<MorseText message={encode('E')} />);
    expect(screen.getByTestId('morse-output')).toBeOnTheScreen();
  });

  it('accepts a caller-supplied test id', () => {
    render(<MorseText message={encode('E')} testID="decoded-preview" />);
    expect(screen.getByTestId('decoded-preview')).toBeOnTheScreen();
  });

  it('renders nothing but the container for an empty message', () => {
    render(<MorseText message={encode('   ')} />);
    expect(screen.getByTestId('morse-output')).toBeEmptyElement();
  });

  it('keeps every letter cell at the 44pt touch-target floor', () => {
    render(<MorseText message={encode('SOS')} />);
    for (const cell of screen.getAllByTestId('morse-letter')) {
      expect(cell).toHaveStyle({ minHeight: 44, minWidth: 44 });
    }
  });
});

describe('MorseText — playback', () => {
  it('shows no playback state when nothing is playing', () => {
    render(<MorseText message={encode('SOS')} />);
    expect(screen.queryAllByRole('button', { selected: true })).toHaveLength(0);
  });

  it('lights the letter the playhead is on, and only that one', () => {
    render(<MorseText message={encode('SOS')} soundingIndex={1} />);

    expect(screen.getAllByRole('button', { selected: true })).toHaveLength(1);
    expect(
      screen.getByRole('button', { selected: true, name: 'morse-letter-O' }),
    ).toBeOnTheScreen();
  });

  // Turning the output itself into the progress indicator: what is behind the
  // playhead reads differently from what is still to come.
  it('tints the letters already played and leaves the rest plain', () => {
    render(<MorseText message={encode('SOS')} soundingIndex={1} />);
    const [first, current, last] = screen.getAllByTestId('morse-letter');

    expect(first).toHaveStyle({ backgroundColor: '#e7f6f3' });
    expect(current).toHaveStyle({ backgroundColor: '#12a594' });
    expect(last).toHaveStyle({ backgroundColor: '#f2f4f7' });
  });

  // A tap selection left over from before playback would otherwise sit lit in
  // the middle of a running message.
  it('lets playback override a selection made earlier', () => {
    render(<MorseText message={encode('SOS')} selectedIndex={2} soundingIndex={0} />);

    expect(screen.getAllByRole('button', { selected: true })).toHaveLength(1);
    expect(
      screen.getByRole('button', { selected: true, name: 'morse-letter-S' }),
    ).toBeOnTheScreen();
    expect(screen.getAllByTestId('morse-letter')[2]).toHaveStyle({
      backgroundColor: '#f2f4f7',
    });
  });

  it('goes back to the selection once playback ends', () => {
    render(<MorseText message={encode('SOS')} selectedIndex={2} soundingIndex={null} />);

    expect(screen.getAllByTestId('morse-letter')[2]).toHaveStyle({
      backgroundColor: '#12a594',
    });
  });
});
