import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Card } from './Card';

describe('Card', () => {
  it('renders its children', () => {
    render(
      <Card>
        <Text>inside</Text>
      </Card>,
    );
    expect(screen.getByText('inside')).toBeOnTheScreen();
  });

  it('grows only when asked to', () => {
    render(
      <Card testID="plain">
        <Text>a</Text>
      </Card>,
    );
    expect(screen.getByTestId('plain')).not.toHaveStyle({ flexGrow: 1 });
  });

  // Regression: the grow card had flexGrow without flexShrink. React Native
  // defaults flexShrink to 0, so a long message grew the card past the screen
  // and pushed the action row — Flash, audio, copy — out of view entirely.
  it('can shrink as well as grow, so it never pushes siblings off-screen', () => {
    render(
      <Card grow testID="grown">
        <Text>a</Text>
      </Card>,
    );
    expect(screen.getByTestId('grown')).toHaveStyle({ flexShrink: 1 });
  });

  it('takes the remaining space when grow is set', () => {
    render(
      <Card grow testID="grown">
        <Text>a</Text>
      </Card>,
    );
    expect(screen.getByTestId('grown')).toHaveStyle({ flexGrow: 1 });
  });
});
