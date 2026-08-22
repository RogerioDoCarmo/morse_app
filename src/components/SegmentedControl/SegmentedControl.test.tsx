import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SegmentedControl } from './SegmentedControl';

const SEGMENTS = [
  { value: 'toMorse', label: 'Text → Morse' },
  { value: 'toText', label: 'Morse → Text' },
] as const;

describe('SegmentedControl', () => {
  it('marks only the selected segment as selected', () => {
    render(<SegmentedControl segments={SEGMENTS} value="toMorse" onChange={jest.fn()} />);
    expect(screen.getByTestId('segment-toMorse')).toBeSelected();
    expect(screen.getByTestId('segment-toText')).not.toBeSelected();
  });

  it('reports the value that was pressed', () => {
    const onChange = jest.fn();
    render(<SegmentedControl segments={SEGMENTS} value="toMorse" onChange={onChange} />);
    fireEvent.press(screen.getByTestId('segment-toText'));
    expect(onChange).toHaveBeenCalledWith('toText');
  });

  it('does not fire for the already-selected segment beyond reporting it', () => {
    const onChange = jest.fn();
    render(<SegmentedControl segments={SEGMENTS} value="toMorse" onChange={onChange} />);
    fireEvent.press(screen.getByTestId('segment-toMorse'));
    expect(onChange).toHaveBeenCalledWith('toMorse');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('renders every segment label', () => {
    render(<SegmentedControl segments={SEGMENTS} value="toText" onChange={jest.fn()} />);
    expect(screen.getByText('Text → Morse')).toBeOnTheScreen();
    expect(screen.getByText('Morse → Text')).toBeOnTheScreen();
  });
});
