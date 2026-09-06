import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('calls onPress', () => {
    const onPress = jest.fn();
    render(<IconButton name="copy" label="copy-morse" onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('copy-morse'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('falls back to the label as the test id', () => {
    render(<IconButton name="volume" label="play-audio" onPress={jest.fn()} />);
    expect(screen.getByTestId('play-audio')).toBeOnTheScreen();
  });

  it('prefers an explicit test id when given one', () => {
    render(
      <IconButton
        name="volume"
        label="play-audio"
        testID="custom-id"
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByTestId('custom-id')).toBeOnTheScreen();
  });

  it('renders the requested glyph', () => {
    render(<IconButton name="zap" label="flash" onPress={jest.fn()} />);
    expect(screen.getByTestId('icon-zap')).toBeOnTheScreen();
  });
});
