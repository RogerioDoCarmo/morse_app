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
      'Morse needs the microphone to hear you.',
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
