import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePorts } from '@/application/providers/PortsProvider';
import { letterAt, messageOfLetter, type MorseMessage } from '@/core/domain/morse';
import {
  DEFAULT_PLAYBACK_UNIT_MS,
  clampPlaybackUnitMs,
  letterSpans,
  soundingIndexAt,
  toTimeline,
  totalMs,
} from '@/core/domain/timeline';
import { renderWav } from '@/core/domain/tone';

/**
 * How often the progress readout refreshes.
 *
 * The clock is separate from the audio on purpose: expo-audio reports its
 * position only in status callbacks, at a rate this app does not control, and
 * a progress bar that advances in visible jumps looks broken. Both are driven
 * from the same rendered timeline, so they cannot drift.
 */
const TICK_MS = 50;

/** Where playback is, and how to drive it. */
export type MorsePlayback = Readonly<{
  playing: boolean;
  /** Letter the playhead is on, or null when nothing is playing. */
  soundingIndex: number | null;
  /** How far through the message playback is, from 0 to 1. */
  progress: number;
  elapsedMs: number;
  /** How long the whole message takes at the current speed. */
  durationMs: number;
  play: () => void;
  stop: () => void;
  /**
   * Plays one letter on its own, as a preview. Reports no progress: a letter
   * is at most eleven units, and a bar that appeared and vanished inside a
   * second would read as a glitch rather than as feedback.
   */
  playLetter: (index: number) => void;
}>;

/**
 * Plays a message as sound and reports where the playhead is.
 *
 * Renders the audio from the domain and hands the bytes to the port, so this
 * hook knows nothing about expo-audio, files or codecs.
 */
export function useMorsePlayback(
  message: MorseMessage,
  unitMs: number = DEFAULT_PLAYBACK_UNIT_MS,
): MorsePlayback {
  const { audio } = usePorts();
  const unit = clampPlaybackUnitMs(unitMs);

  const timeline = useMemo(() => toTimeline(message), [message]);
  const spans = useMemo(() => letterSpans(message), [message]);
  const durationMs = totalMs(timeline, unit);

  const [elapsedMs, setElapsedMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTicker = useCallback((): void => {
    if (ticker.current !== null) {
      clearInterval(ticker.current);
      ticker.current = null;
    }
  }, []);

  const stop = useCallback((): void => {
    clearTicker();
    setPlaying(false);
    setElapsedMs(0);
    void audio.stop();
  }, [audio, clearTicker]);

  const play = useCallback((): void => {
    // Nothing to play is not an error, and starting anyway would leave a
    // progress bar sitting at zero with no way back.
    if (timeline.totalUnits === 0) return;

    clearTicker();
    const startedAt = Date.now();
    setPlaying(true);
    setElapsedMs(0);
    ticker.current = setInterval(() => {
      setElapsedMs(Math.min(durationMs, Date.now() - startedAt));
    }, TICK_MS);

    // The port resolves when playback finishes OR is stopped, so this one
    // continuation covers both endings.
    void audio.play(renderWav(timeline, { unitMs: unit })).then(() => {
      clearTicker();
      setPlaying(false);
      setElapsedMs(0);
    });
  }, [audio, clearTicker, durationMs, timeline, unit]);

  const playLetter = useCallback(
    (index: number): void => {
      const letter = letterAt(message, index);
      if (letter === null || letter.symbols.length === 0) return;

      // A preview interrupts the message rather than layering over it — the
      // port plays one thing at a time, and two Morse signals at once are
      // unreadable. Clearing here as well keeps the progress UI from running
      // on over audio that has been replaced.
      clearTicker();
      setPlaying(false);
      setElapsedMs(0);

      void audio.play(renderWav(toTimeline(messageOfLetter(letter)), { unitMs: unit }));
    },
    [audio, clearTicker, message, unit],
  );

  // Editing the text mid-playback, or leaving the screen, must not leave a
  // clock running over a message that is no longer on screen — the audio was
  // rendered from the old one and cannot be edited in flight.
  useEffect(() => {
    return () => {
      clearTicker();
      void audio.stop();
      setPlaying(false);
      setElapsedMs(0);
    };
  }, [message, audio, clearTicker]);

  return {
    playing,
    soundingIndex: playing ? soundingIndexAt(spans, elapsedMs / unit) : null,
    progress: durationMs === 0 ? 0 : elapsedMs / durationMs,
    elapsedMs,
    durationMs,
    play,
    stop,
    playLetter,
  };
}
