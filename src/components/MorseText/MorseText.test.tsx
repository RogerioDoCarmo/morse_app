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
