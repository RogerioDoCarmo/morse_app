import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { Ports, SpeechResult } from '@/core/ports';
import { createFakePorts, type FakePorts } from '@/testing/fakePorts';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { SpeechScreen } from './SpeechScreen';

/** A recogniser the test drives: emit results and errors on demand. */
function recogniser(available = true): Readonly<{
  port: Ports['speech'];
  emit: (result: SpeechResult) => void;
  fail: (reason: string) => void;
  released: () => number;
  stops: () => number;
}> {
  const state: {
    onResult: (result: SpeechResult) => void;
    onError: (reason: string) => void;
    released: number;
    stops: number;
  } = {
    onResult: () => undefined,
    onError: () => undefined,
    released: 0,
    stops: 0,
  };
  return {
    released: () => state.released,
    stops: () => state.stops,
    emit: (result) => {
      state.onResult(result);
    },
    fail: (reason) => {
      state.onError(reason);
    },
    port: {
      isAvailable: async () => available,
      start: async (_locale, onResult, onError) => {
        state.onResult = onResult;
        state.onError = onError;
        return () => {
          state.released += 1;
        };
      },
      stop: async () => {
        state.stops += 1;
      },
    },
  };
}

const render = (port: Ports['speech'], locale?: 'en' | 'pt-BR' | 'es'): FakePorts => {
  const ports = createFakePorts({ speech: port });
  renderWithProviders(
    <SpeechScreen onSelectTab={jest.fn()} unavailableTabs={['tap', 'learn']} />,
    locale === undefined ? { ports } : { ports, locale },
  );
  return ports;
};

/**
 * Presses the mic and lets the async availability check settle. `fireEvent`
 * is already wrapped in act; this only waits for what it kicked off.
 */
const tapMic = async (): Promise<void> => {
  fireEvent.press(screen.getByTestId('mic-button'));
  await act(async () => {
    await Promise.resolve();
  });
};

describe('SpeechScreen', () => {
  it('starts idle, inviting a tap', () => {
    render(recogniser().port);
    expect(screen.getByTestId('speech-title')).toHaveTextContent('Tap to speak');
    expect(screen.queryByTestId('speech-transcript')).toBeNull();
  });

  it('listens when the mic is tapped', async () => {
    render(recogniser().port);
    await tapMic();

    expect(screen.getByTestId('speech-title')).toHaveTextContent('Listening…');
    expect(screen.getByTestId('mic-button')).toBeSelected();
  });

  // Partials are the whole reason the port reports them: the Morse grows while
  // the speaker is still talking rather than arriving in one lump.
  it('encodes partial results as they arrive', async () => {
    const mic = recogniser();
    render(mic.port);
    await tapMic();

    act(() => {
      mic.emit({ transcript: 'SOS', isFinal: false });
    });

    expect(screen.getByTestId('speech-transcript')).toHaveTextContent('SOS');
    expect(screen.getByTestId('speech-morse-string')).toHaveTextContent('... --- ...');
    // Still listening — a partial is not the end.
    expect(screen.getByTestId('speech-title')).toHaveTextContent('Listening…');
  });

  /**
   * A TestFlight tester came to this screen looking for the way to feel a
   * transcript as vibration, the way the Translator offers, and found the
   * transcript was a dead end. What was heard is a message like any other.
   */
  describe('sending what was heard', () => {
    it('offers nothing to send until there is something to send', () => {
      render(recogniser().port);

      expect(screen.queryByTestId('output-channels')).toBeNull();
      expect(screen.queryByTestId('signal-button')).toBeNull();
    });

    it('offers all four channels once a transcript arrives', async () => {
      const mic = recogniser();
      render(mic.port);
      await tapMic();

      act(() => {
        mic.emit({ transcript: 'SOS', isFinal: true });
      });

      expect(screen.getByTestId('signal-button')).toBeOnTheScreen();
      for (const channel of ['sound', 'light', 'screen', 'buzz']) {
        expect(screen.getByTestId(`channel-${channel}`)).toBeOnTheScreen();
      }
    });

    // The Screen channel had no surface on this screen either — the toggle
    // worked and nothing flashed. Reported from hardware, not caught by any
    // test, because every test here asserted that a control was PRESENT.
    it('flashes a surface when the Screen channel carries the message', async () => {
      const mic = recogniser();
      render(mic.port);
      await tapMic();
      act(() => {
        mic.emit({ transcript: 'SOS', isFinal: true });
      });

      expect(screen.queryByTestId('signal-surface')).toBeNull();

      fireEvent.press(screen.getByTestId('channel-screen'));
      fireEvent.press(screen.getByTestId('signal-button'));

      expect(screen.getByTestId('signal-surface')).toBeOnTheScreen();
      expect(screen.queryByTestId('speech-morse-string')).toBeNull();
    });

    // Built here rather than through `render`, which returns the ports and so
    // trips testing-library's render-result naming rule.
    it('plays the transcript through the port when Emit is pressed', async () => {
      const mic = recogniser();
      const ports = createFakePorts({ speech: mic.port });
      renderWithProviders(
        <SpeechScreen onSelectTab={jest.fn()} unavailableTabs={['tap', 'learn']} />,
        { ports },
      );
      await tapMic();

      act(() => {
        mic.emit({ transcript: 'SOS', isFinal: true });
      });
      fireEvent.press(screen.getByTestId('signal-button'));

      await waitFor(() => {
        expect(ports.calls.played).toHaveLength(1);
      });
    });
  });

  it('settles once the recogniser commits', async () => {
    const mic = recogniser();
    render(mic.port);
    await tapMic();

    act(() => {
      mic.emit({ transcript: 'hello', isFinal: true });
    });

    expect(screen.getByTestId('speech-title')).toHaveTextContent('Got it');
    expect(screen.getByTestId('speech-transcript')).toHaveTextContent('hello');
  });

  // stop, not release: the final transcript is the point of tapping again.
  it('asks the recogniser to finish when tapped a second time', async () => {
    const mic = recogniser();
    render(mic.port);
    await tapMic();
    await tapMic();

    expect(mic.stops()).toBe(1);
    expect(screen.getByTestId('speech-title')).toHaveTextContent('Got it');
  });

  it('says so when the device cannot recognise the language', async () => {
    render(recogniser(false).port);
    await tapMic();

    expect(screen.getByTestId('speech-hint')).toHaveTextContent(
      'This device cannot recognise this language.',
    );
    expect(screen.queryByTestId('speech-transcript')).toBeNull();
  });

  // Refusing the microphone is a normal answer, not a crash.
  it('says so when the microphone is refused', async () => {
    const mic = recogniser();
    render(mic.port);
    await tapMic();

    act(() => {
      mic.fail('permission');
    });

    expect(screen.getByTestId('speech-hint')).toHaveTextContent(
      'OmniMorse needs the microphone to hear you.',
    );
  });

  it('offers another go when the recogniser fails for another reason', async () => {
    const mic = recogniser();
    render(mic.port);
    await tapMic();

    act(() => {
      mic.fail('no-speech');
    });

    expect(screen.getByTestId('speech-hint')).toHaveTextContent(
      'The recogniser stopped. Tap to try again.',
    );
  });

  it('clears the last transcript when a new attempt starts', async () => {
    const mic = recogniser();
    render(mic.port);
    await tapMic();
    act(() => {
      mic.emit({ transcript: 'first', isFinal: true });
    });

    await tapMic();

    expect(screen.queryByTestId('speech-transcript')).toBeNull();
  });

  it('speaks the interface language', () => {
    render(recogniser().port, 'es');
    expect(screen.getByTestId('speech-title')).toHaveTextContent('Toca para hablar');
  });

  // Leaving the screen must not leave the microphone open.
  it('lets the recogniser go when it unmounts', async () => {
    const mic = recogniser();
    render(mic.port);
    await tapMic();

    screen.unmount();

    await waitFor(() => {
      expect(mic.released()).toBe(1);
    });
  });
});

describe('which language it listens for', () => {
  const holding = (stored: Readonly<Record<string, string>>): FakePorts => {
    const ports = createFakePorts();
    return {
      ...ports,
      preferences: {
        ...ports.preferences,
        read: async (key: string) => stored[key] ?? null,
      },
    };
  };

  /**
   * ⚠️ The DEVICE language when nothing has been chosen — NOT the interface.
   *
   * This test used to assert the opposite. Recognition followed the interface,
   * so switching the app to Portuguese silently pointed the microphone at a
   * recogniser the phone might not even have installed. The two are separate
   * settings now; an unset recogniser means "whatever this phone speaks",
   * which is what it meant on first launch and no longer moves afterwards.
   */
  it('listens in the device language when nothing has been chosen', async () => {
    const isAvailable = jest.fn(async () => true);
    const ports = createFakePorts();
    ports.speech.isAvailable = isAvailable;
    ports.locale.getDeviceLocale = () => 'en';
    renderWithProviders(<SpeechScreen onSelectTab={jest.fn()} unavailableTabs={[]} />, {
      ports,
      // The INTERFACE is Portuguese; the recogniser must not follow it.
      locale: 'pt-BR',
    });
    fireEvent.press(screen.getByTestId('mic-button'));
    await waitFor(() => {
      expect(isAvailable).toHaveBeenCalledWith('en');
    });
    expect(isAvailable).not.toHaveBeenCalledWith('pt-BR');
  });

  // The whole point of the setting: a device may have no recogniser for the
  // language the interface is in.
  it('listens for the chosen recogniser instead, when there is one', async () => {
    const isAvailable = jest.fn(async () => true);
    const ports = holding({ 'settings.speechLocale': 'en' });
    ports.speech.isAvailable = isAvailable;
    renderWithProviders(<SpeechScreen onSelectTab={jest.fn()} unavailableTabs={[]} />, {
      ports,
      locale: 'pt-BR',
    });
    await waitFor(() => {
      expect(screen.getByTestId('speech-screen')).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByTestId('mic-button'));
    await waitFor(() => {
      expect(isAvailable).toHaveBeenCalledWith('en');
    });
  });
});

describe('the microphone permission stands in front of the recogniser', () => {
  const DENIED = { granted: false, canAskAgain: true } as const;

  it('asks why before the recogniser can ask on its own', async () => {
    const ports = createFakePorts({}, DENIED);
    renderWithProviders(<SpeechScreen onSelectTab={jest.fn()} unavailableTabs={[]} />, {
      ports,
    });
    fireEvent.press(screen.getByTestId('mic-button'));
    await waitFor(() => {
      expect(screen.getByTestId('permission-microphone')).toBeOnTheScreen();
    });
  });

  it('never starts listening when the rationale is dismissed', async () => {
    const isAvailable = jest.fn(async () => true);
    const ports = createFakePorts({}, DENIED);
    ports.speech.isAvailable = isAvailable;
    renderWithProviders(<SpeechScreen onSelectTab={jest.fn()} unavailableTabs={[]} />, {
      ports,
    });
    fireEvent.press(screen.getByTestId('mic-button'));
    await waitFor(() => {
      expect(screen.getByTestId('permission-microphone')).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByTestId('permission-dismiss'));
    await waitFor(() => {
      expect(screen.queryByTestId('permission-microphone')).toBeNull();
    });
    expect(isAvailable).not.toHaveBeenCalled();
  });

  it('goes on to listen once the permission is granted', async () => {
    const isAvailable = jest.fn(async () => true);
    const ports = createFakePorts({}, DENIED);
    ports.speech.isAvailable = isAvailable;
    renderWithProviders(<SpeechScreen onSelectTab={jest.fn()} unavailableTabs={[]} />, {
      ports,
    });
    fireEvent.press(screen.getByTestId('mic-button'));
    await waitFor(() => {
      expect(screen.getByTestId('permission-microphone')).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByTestId('permission-primary'));
    await waitFor(() => {
      expect(isAvailable).toHaveBeenCalled();
    });
  });
});

/**
 * ⚠️ Reported from an iPhone: with a transcript on screen, "Toque no microfone
 * para gravar de novo" was invisible and the title above it was cut in half.
 *
 * The cause was `flex: 1` on the stage, which is `flexShrink: 1` plus
 * `flexBasis: 0%` — so the stage shrank below its own content, and because it
 * centres that content the overflow went out both edges. It looked like the
 * transcript card was sitting on top of the text; the stage was collapsing
 * underneath it.
 */
describe('the stage does not collapse under a transcript', () => {
  const flatten = (style: unknown): Record<string, unknown> =>
    Object.assign({}, ...[style].flat(Infinity).filter(Boolean)) as Record<
      string,
      unknown
    >;

  it('keeps its own content height when a transcript appears', () => {
    renderWithProviders(<SpeechScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    const style = flatten(screen.getByTestId('speech-stage').props.style);
    // The three that matter, asserted by value rather than by "not flex: 1":
    // basis from content, never shrink below it, still grow into free space.
    expect(style.flexBasis).toBe('auto');
    expect(style.flexShrink).toBe(0);
    expect(style.flexGrow).toBe(1);
  });
});
