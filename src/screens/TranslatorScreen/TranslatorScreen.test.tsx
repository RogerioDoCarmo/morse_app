import React from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { encode } from '@/core/domain/morse';
import { DEFAULT_PLAYBACK_UNIT_MS, toTimeline } from '@/core/domain/timeline';
import { renderWav } from '@/core/domain/tone';
import type { Ports } from '@/core/ports';
import { createFakePorts, type FakePorts } from '@/testing/fakePorts';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { TranslatorScreen } from './TranslatorScreen';

describe('TranslatorScreen', () => {
  it('encodes what is typed', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');
    expect(screen.getByTestId('morse-string')).toHaveTextContent('... --- ...');
  });

  it('re-encodes as the text changes', () => {
    renderWithProviders(<TranslatorScreen />);
    const input = screen.getByTestId('translator-input');
    fireEvent.changeText(input, 'E');
    expect(screen.getByTestId('morse-string')).toHaveTextContent('.');
    fireEvent.changeText(input, 'T');
    expect(screen.getByTestId('morse-string')).toHaveTextContent('-');
  });

  it('encodes accented input by the rule the domain settled on', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'AÇÃO');
    expect(screen.getByTestId('morse-string')).toHaveTextContent('.- -.-.. .- ---');
  });

  it('drives the torch through the port, not a library', async () => {
    const { ports } = renderWithProviders(<TranslatorScreen />);
    fireEvent.press(screen.getByTestId('flash-button'));
    await waitFor(() => {
      expect(ports.calls.torchEnabled).toEqual([true]);
    });
  });

  it('turns the torch back off on a second press', async () => {
    const { ports } = renderWithProviders(<TranslatorScreen />);
    fireEvent.press(screen.getByTestId('flash-button'));
    await waitFor(() => {
      expect(ports.calls.torchEnabled).toEqual([true]);
    });
    fireEvent.press(screen.getByTestId('flash-button'));
    await waitFor(() => {
      expect(ports.calls.torchEnabled).toEqual([true, false]);
    });
  });

  it('renders in the selected locale', () => {
    renderWithProviders(<TranslatorScreen />, { locale: 'es' });
    expect(screen.getByText('Destellar')).toBeOnTheScreen();
  });
});

describe('TranslatorScreen — direction', () => {
  it('starts in text → Morse', () => {
    renderWithProviders(<TranslatorScreen />);
    expect(screen.getByTestId('segment-toMorse')).toBeSelected();
  });

  it('swaps the panes when the direction changes', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.press(screen.getByTestId('segment-toText'));

    expect(screen.getByTestId('segment-toText')).toBeSelected();
    // The decoded text and its read-aloud affordance only exist that way round.
    expect(screen.getByTestId('decoded-text')).toBeOnTheScreen();
    expect(screen.getByTestId('read-aloud')).toBeOnTheScreen();
  });

  it('offers speech in one direction and the tap key in the other', () => {
    renderWithProviders(<TranslatorScreen />);
    expect(screen.getByTestId('speak-input')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('segment-toText'));
    expect(screen.getByTestId('tap-input')).toBeOnTheScreen();
    expect(screen.queryByTestId('speak-input')).toBeNull();
  });

  it('decodes typed Morse back to text', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.press(screen.getByTestId('segment-toText'));
    fireEvent.changeText(screen.getByTestId('translator-input'), '... --- ...');
    expect(screen.getByTestId('decoded-text')).toHaveTextContent('SOS');
  });

  it('reads the decoded text aloud in the active locale', async () => {
    const { ports } = renderWithProviders(<TranslatorScreen />, { locale: 'es' });
    fireEvent.press(screen.getByTestId('segment-toText'));
    fireEvent.changeText(screen.getByTestId('translator-input'), '... --- ...');
    fireEvent.press(screen.getByTestId('read-aloud'));

    await waitFor(() => {
      expect(ports.calls.spoken).toContainEqual({ text: 'SOS', locale: 'es' });
    });
  });
});

describe('TranslatorScreen — letter selection', () => {
  it('selects nothing to begin with', () => {
    renderWithProviders(<TranslatorScreen />);
    for (const cell of screen.getAllByTestId('morse-letter')) {
      expect(cell).not.toBeSelected();
    }
  });

  it('selects the letter that was tapped, and only that one', () => {
    renderWithProviders(<TranslatorScreen />);
    const cells = screen.getAllByTestId('morse-letter');
    const target = cells[2];
    expect(target).toBeDefined();
    fireEvent.press(target);

    const after = screen.getAllByTestId('morse-letter');
    expect(after[2]).toBeSelected();
    expect(after[0]).not.toBeSelected();
  });

  it('counts the index across word boundaries, not per word', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'AB CD');
    const cells = screen.getAllByTestId('morse-letter');
    // Fourth cell overall is D — the second letter of the second word.
    const fourth = cells[3];
    expect(fourth).toBeDefined();
    fireEvent.press(fourth);
    expect(screen.getAllByTestId('morse-letter')[3]).toBeSelected();
    expect(screen.getAllByTestId('morse-letter')[2]).not.toBeSelected();
  });
});

describe('TranslatorScreen — seed content', () => {
  it('seeds the input in the active locale, not always English', () => {
    renderWithProviders(<TranslatorScreen />, { locale: 'es' });
    expect(screen.getByTestId('translator-input')).toHaveProp('value', 'Hola mundo');
  });

  it('seeds Portuguese without accents the encoder would fold', () => {
    renderWithProviders(<TranslatorScreen />, { locale: 'pt-BR' });
    expect(screen.getByTestId('translator-input')).toHaveProp('value', 'Boa noite');
  });

  it('derives the Morse seed from the same sample, so the directions agree', () => {
    renderWithProviders(<TranslatorScreen />, { locale: 'es' });
    fireEvent.press(screen.getByTestId('segment-toText'));
    // Round-trips back to the very sample the other direction started from.
    expect(screen.getByTestId('decoded-text')).toHaveTextContent('HOLA MUNDO');
  });

  it('separates words with the ITU slash, which survives a copy', () => {
    renderWithProviders(<TranslatorScreen />);
    expect(screen.getByTestId('morse-string')).toHaveTextContent(
      '.... . .-.. .-.. --- / .-- --- .-. .-.. -..',
    );
  });
});

/**
 * An audio port whose playback stays in flight until the test ends it, so the
 * playing state can be observed. The real adapter resolves on finish OR stop;
 * `finish` and `stop` here are the two ways that happens.
 */
function pendingAudio(): Readonly<{
  played: Uint8Array[];
  stops: number;
  finish: () => void;
  port: Ports['audio'];
}> {
  const played: Uint8Array[] = [];
  const state = { stops: 0, resolve: (): void => undefined };
  return {
    played,
    get stops(): number {
      return state.stops;
    },
    finish: (): void => {
      state.resolve();
    },
    port: {
      play: (wav) => {
        played.push(wav);
        return new Promise<void>((resolve) => {
          state.resolve = resolve;
        });
      },
      stop: () => {
        state.stops += 1;
        state.resolve();
        return Promise.resolve();
      },
    },
  };
}

const withAudio = (port: Ports['audio']): FakePorts => createFakePorts({ audio: port });

describe('TranslatorScreen — audio playback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  /** Advances both the clock the hook reads and the timer it ticks on. */
  const advance = async (ms: number): Promise<void> => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
      await Promise.resolve();
    });
  };

  it('hands the port a real WAV of the message on screen', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });

    fireEvent.press(screen.getByTestId('play-audio'));

    expect(audio.played).toHaveLength(1);
    // "RIFF" — the port takes bytes, and these are the bytes of a WAV file.
    expect(Array.from(audio.played[0]?.slice(0, 4) ?? [])).toEqual([82, 73, 70, 70]);
  });

  it('shows the message playing, with a clock that runs', async () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });

    fireEvent.press(screen.getByTestId('play-audio'));

    expect(screen.getByTestId('playing-badge')).toBeOnTheScreen();
    expect(screen.getByTestId('playback-progress')).toBeOnTheScreen();
    // "Hello world" is 111 units; at the 120ms playback default that is 13.3s.
    expect(screen.getByTestId('playback-clock')).toHaveTextContent('0:00 / 0:13');

    await advance(5000);
    expect(screen.getByTestId('playback-clock')).toHaveTextContent('0:05 / 0:13');
  });

  it('replaces the hint with the playing state, and puts it back after', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });

    expect(screen.queryByTestId('playing-badge')).toBeNull();
    fireEvent.press(screen.getByTestId('play-audio'));
    expect(screen.getByTestId('playing-badge')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('play-audio'));
    expect(screen.queryByTestId('playing-badge')).toBeNull();
  });

  it('lights the letter the playhead is on, and moves it along', async () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    fireEvent.press(screen.getByTestId('play-audio'));

    const output = (): ReturnType<typeof within> =>
      within(screen.getByTestId('morse-output'));

    // H starts the message and holds through the gap that follows it.
    expect(output().getAllByRole('button', { selected: true })).toHaveLength(1);
    expect(
      output().getByRole('button', { selected: true, name: 'morse-letter-H' }),
    ).toBeOnTheScreen();

    // E begins 10 units in — 1200ms at the playback default.
    await advance(1300);
    expect(
      output().getByRole('button', { selected: true, name: 'morse-letter-E' }),
    ).toBeOnTheScreen();
    expect(output().getAllByRole('button', { selected: true })).toHaveLength(1);
  });

  it('stops through the port when the button is pressed again', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });

    fireEvent.press(screen.getByTestId('play-audio'));
    fireEvent.press(screen.getByTestId('play-audio'));

    expect(audio.stops).toBeGreaterThan(0);
    expect(screen.queryByTestId('playback-progress')).toBeNull();
  });

  it('clears the playing state when the audio reaches the end on its own', async () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    fireEvent.press(screen.getByTestId('play-audio'));

    await act(async () => {
      audio.finish();
      await Promise.resolve();
    });

    expect(screen.queryByTestId('playback-progress')).toBeNull();
    expect(screen.queryByTestId('playing-badge')).toBeNull();
  });

  // The audio was rendered from the old text and cannot be edited in flight.
  it('stops when the message is edited mid-playback', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    fireEvent.press(screen.getByTestId('play-audio'));

    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');

    expect(screen.queryByTestId('playback-progress')).toBeNull();
    expect(audio.stops).toBeGreaterThan(0);
  });

  it('plays nothing at all when there is nothing to play', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });

    fireEvent.changeText(screen.getByTestId('translator-input'), '');
    fireEvent.press(screen.getByTestId('play-audio'));

    expect(audio.played).toHaveLength(0);
    expect(screen.queryByTestId('playback-progress')).toBeNull();
  });
});

describe('TranslatorScreen — characters Morse cannot carry', () => {
  it('says nothing when everything typed can be encoded', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');
    expect(screen.queryByTestId('unsupported-notice')).toBeNull();
  });

  // The defect this exists for: these characters are dropped, and were dropped
  // without a word to the sender.
  it('names the characters it had to drop', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'HI #');
    expect(screen.getByTestId('unsupported-notice')).toHaveTextContent('No code for: #');
    // And the rest of the message still encodes.
    expect(screen.getByTestId('morse-string')).toHaveTextContent('.... ..');
  });

  it('lists each one once, however often it was typed', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), '#a~b#c~');
    expect(screen.getByTestId('unsupported-notice')).toHaveTextContent(
      'No code for: # ~',
    );
  });

  it('says nothing about accents it folds onto a letter', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'AÇÃO');
    expect(screen.queryByTestId('unsupported-notice')).toBeNull();
  });

  it('replaces the hint, and gives it back once the text is encodable', () => {
    renderWithProviders(<TranslatorScreen />);
    const input = screen.getByTestId('translator-input');

    fireEvent.changeText(input, '#');
    expect(screen.getByTestId('unsupported-notice')).toBeOnTheScreen();

    fireEvent.changeText(input, 'OK');
    expect(screen.queryByTestId('unsupported-notice')).toBeNull();
  });

  it('warns in the interface language', () => {
    renderWithProviders(<TranslatorScreen />, { locale: 'es' });
    fireEvent.changeText(screen.getByTestId('translator-input'), '#');
    expect(screen.getByTestId('unsupported-notice')).toHaveTextContent('Sin código: #');
  });

  // What is happening now outranks a warning about what was typed.
  it('yields the slot to playback while a message is playing', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });

    fireEvent.changeText(screen.getByTestId('translator-input'), 'HI #');
    expect(screen.getByTestId('unsupported-notice')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('play-audio'));
    expect(screen.queryByTestId('unsupported-notice')).toBeNull();
    expect(screen.getByTestId('playing-badge')).toBeOnTheScreen();
  });

  // Morse in, text out: an untranslatable token already shows as the
  // undecodable glyph, which is a different signal on a different pane.
  it('stays out of the way in the other direction', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.press(screen.getByTestId('segment-toText'));
    expect(screen.queryByTestId('unsupported-notice')).toBeNull();
  });
});

describe('TranslatorScreen — hearing one letter', () => {
  /** The bytes the domain would render for `text` on its own. */
  const wavFor = (text: string): Uint8Array =>
    renderWav(toTimeline(encode(text)), { unitMs: DEFAULT_PLAYBACK_UNIT_MS });

  it('plays only the letter that was tapped', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');

    fireEvent.press(screen.getByLabelText('morse-letter-O'));

    expect(audio.played).toHaveLength(1);
    // Exactly O on its own — not the message, and not O's position in it.
    expect(Array.from(audio.played[0] ?? [])).toEqual(Array.from(wavFor('O')));
  });

  it('plays a different letter when a different one is tapped', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    fireEvent.changeText(screen.getByTestId('translator-input'), 'AT');

    fireEvent.press(screen.getByLabelText('morse-letter-A'));
    fireEvent.press(screen.getByLabelText('morse-letter-T'));

    expect(Array.from(audio.played[0] ?? [])).toEqual(Array.from(wavFor('A')));
    expect(Array.from(audio.played[1] ?? [])).toEqual(Array.from(wavFor('T')));
  });

  it('still selects the letter it plays', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');

    fireEvent.press(screen.getByLabelText('morse-letter-O'));

    expect(
      within(screen.getByTestId('morse-output')).getAllByRole('button', {
        selected: true,
      }),
    ).toHaveLength(1);
  });

  it('replays on every tap, including the same letter twice', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    fireEvent.changeText(screen.getByTestId('translator-input'), 'E');

    fireEvent.press(screen.getByLabelText('morse-letter-E'));
    fireEvent.press(screen.getByLabelText('morse-letter-E'));

    expect(audio.played).toHaveLength(2);
  });

  // A preview interrupts rather than layering: two Morse signals at once are
  // unreadable, and the progress UI must not run on over replaced audio.
  it('ends a message that was playing, and clears its progress', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');

    fireEvent.press(screen.getByTestId('play-audio'));
    expect(screen.getByTestId('playback-progress')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('morse-letter-O'));

    expect(screen.queryByTestId('playback-progress')).toBeNull();
    expect(screen.queryByTestId('playing-badge')).toBeNull();
    expect(Array.from(audio.played[1] ?? [])).toEqual(Array.from(wavFor('O')));
  });
});
