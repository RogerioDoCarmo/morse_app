import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('calls onPress', async () => {
    const onPress = jest.fn();
    await render(<IconButton name="copy" label="copy-morse" onPress={onPress} />);
    await fireEvent.press(screen.getByLabelText('copy-morse'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('falls back to the label as the test id', async () => {
    await render(<IconButton name="volume" label="play-audio" onPress={jest.fn()} />);
    expect(screen.getByTestId('play-audio')).toBeOnTheScreen();
  });

  it('prefers an explicit test id when given one', async () => {
    await render(
      <IconButton
        name="volume"
        label="play-audio"
        testID="custom-id"
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByTestId('custom-id')).toBeOnTheScreen();
  });

  it('renders the requested glyph', async () => {
    await render(<IconButton name="zap" label="flash" onPress={jest.fn()} />);
    expect(screen.getByTestId('icon-zap')).toBeOnTheScreen();
  });
});
