import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Toast } from './Toast';

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows nothing when it is not wanted', () => {
    render(<Toast visible={false} message="too quiet" onDismiss={jest.fn()} />);
    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('shows the message it was given', () => {
    render(<Toast visible message="too quiet" onDismiss={jest.fn()} />);
    expect(screen.getByTestId('toast')).toHaveTextContent('too quiet');
  });

  it('goes away when tapped', () => {
    const onDismiss = jest.fn();
    render(<Toast visible message="too quiet" onDismiss={onDismiss} />);

    fireEvent.press(screen.getByTestId('toast'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  /**
   * A warning about a volume the user is already turning up should not need a
   * tap to go away, and one that outlives the message it was about is clutter
   * over whatever they do next.
   */
  it('takes itself away after six seconds', () => {
    const onDismiss = jest.fn();
    render(<Toast visible message="too quiet" onDismiss={onDismiss} />);

    act(() => {
      jest.advanceTimersByTime(5900);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // Unmounting while the clock is running must not call back into a screen
  // that has gone.
  it('drops its timer when it is taken off the screen', () => {
    const onDismiss = jest.fn();
    const view = render(<Toast visible message="too quiet" onDismiss={onDismiss} />);

    view.unmount();
    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('starts no timer while it is hidden', () => {
    const onDismiss = jest.fn();
    render(<Toast visible={false} message="too quiet" onDismiss={onDismiss} />);

    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  // The user is not looking at this part of the screen — they are waiting to
  // hear something — so it has to announce itself.
  it('announces itself to a screen reader', () => {
    render(<Toast visible message="too quiet" onDismiss={jest.fn()} />);
    expect(screen.getByRole('alert')).toBeOnTheScreen();
  });
});

/**
 * The action exists for one reason: a channel that cannot switch on needs to
 * say where to fix it. ⚠️ It lives INSIDE the dismissing Pressable rather than
 * beside it — two targets in one 44pt strip means a near miss on the action
 * deletes the thing the user was reaching for.
 */
describe('the optional way out', () => {
  it('shows nothing extra when no action is given', () => {
    render(<Toast visible message="Quiet" onDismiss={jest.fn()} />);

    expect(screen.queryByTestId('toast-action')).toBeNull();
  });

  it('shows the action label when one is given', () => {
    render(
      <Toast
        visible
        message="Light needs the camera"
        onDismiss={jest.fn()}
        action={{ label: 'Settings', onPress: jest.fn() }}
      />,
    );

    expect(screen.getByTestId('toast-action')).toHaveTextContent('Settings');
  });

  it('runs the action when it is pressed', () => {
    const onPress = jest.fn();
    render(
      <Toast
        visible
        message="Light needs the camera"
        onDismiss={jest.fn()}
        action={{ label: 'Settings', onPress }}
      />,
    );

    fireEvent.press(screen.getByTestId('toast-action'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  /**
   * ⚠️ It does NOT dismiss itself. Opening the system settings sends the user
   * out of the app; a toast that vanished on the way would leave nothing to
   * come back to.
   */
  it('leaves dismissing to the caller', () => {
    const onDismiss = jest.fn();
    render(
      <Toast
        visible
        message="Light needs the camera"
        onDismiss={onDismiss}
        action={{ label: 'Settings', onPress: jest.fn() }}
      />,
    );

    fireEvent.press(screen.getByTestId('toast-action'));

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
