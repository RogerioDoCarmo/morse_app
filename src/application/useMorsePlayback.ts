import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePorts } from '@/application/providers/PortsProvider';
import { letterAt, messageOfLetter, type MorseMessage } from '@/core/domain/morse';
import {
  DEFAULT_PLAYBACK_UNIT_MS,
  clampPlaybackUnitMs,
  letterSpans,
  signalAt,
  signalChanges,
  soundingIndexAt,
  timelineFrom,
  toTimeline,
  totalMs,
} from '@/core/domain/timeline';
import { renderWav } from '@/core/domain/tone';

/**
 * How often the progress readout refreshes.
 *
 * The clock is separate from the audio on purpose: expo-audio reports its
 * position only in status callbacks, at a rate this app does not control, and
 * a progress bar that advances in visible jumps looks broken.
 */
const TICK_MS = 50;

/**
 * How often the on/off outputs are driven.
 *
 * Much finer than the progress tick, because this one has to be accurate: a
 * dot is 120ms at the default speed, so 50ms of slop would be a third of it.
 * It touches no React state, so it costs a comparison and nothing else.
 */
const DRIVE_MS = 10;

/** The ways a message can go out. Vibration is designed, not built. */
export type OutputChannel = 'sound' | 'light' | 'screen';

/** Where playback is, how to drive it, and which outputs are carrying it. */
export type MorsePlayback = Readonly<{
  playing: boolean;
  /** Letter the playhead is on, or null when nothing is playing. */
  soundingIndex: number | null;
  /** How far through the message playback is, from 0 to 1. */
  progress: number;
  elapsedMs: number;
  /** How long the whole message takes at the current speed. */
  durationMs: number;
  /** Which outputs are switched on. */
  channels: Readonly<Record<OutputChannel, boolean>>;
  /**
   * Whether the on-screen surface is lit right now. Changes only when the
   * signal does — at most twice a unit — not on every pass of the driver.
   */
  screenLit: boolean;
  /** Switches one output on or off, taking effect immediately. */
  toggleChannel: (channel: OutputChannel) => void;
  /** False when there is nothing to play, or nothing to play it on. */
  canPlay: boolean;
  play: () => void;
  stop: () => void;
  /**
   * Plays one letter on its own, as a preview. Reports no progress: a letter
   * is at most eleven units, and a bar that appeared and vanished inside a
   * second would read as a glitch rather than as feedback.
   *
   * Ignored while a message is playing.
   */
  playLetter: (index: number) => void;
}>;

/**
 * Plays a message across several outputs at once, and reports where the
 * playhead is.
 *
 * There is ONE run. The channels choose which ways it goes out, and they are
 * live — switching one on mid-message joins the run already in progress rather
 * than starting a second one beside it, which would transmit the same message
 * twice, out of step.
 */
export function useMorsePlayback(
  message: MorseMessage,
  unitMs: number = DEFAULT_PLAYBACK_UNIT_MS,
): MorsePlayback {
  const { audio, torch } = usePorts();
  const unit = clampPlaybackUnitMs(unitMs);

  const timeline = useMemo(() => toTimeline(message), [message]);
  const spans = useMemo(() => letterSpans(message), [message]);
  const changes = useMemo(() => signalChanges(timeline), [timeline]);
  const durationMs = totalMs(timeline, unit);

  const [elapsedMs, setElapsedMs] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Sound on, Light off: switching Light on is what raises the camera
  // permission, and a new user's first press should not open a system dialog.
  const [channels, setChannels] = useState<Record<OutputChannel, boolean>>({
    sound: true,
    light: false,
    screen: false,
  });
  const [screenLit, setScreenLit] = useState(false);

  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const driver = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  /** Read by the driver, which must see a toggle without being restarted. */
  const live = useRef<Record<OutputChannel, boolean>>(channels);
  /** What the torch was last told, so it is not told the same thing repeatedly. */
  const lit = useRef(false);
  /** The same, for the on-screen surface — this one guards a re-render. */
  const surface = useRef(false);

  const elapsedUnits = useCallback(
    (): number => (Date.now() - startedAt.current) / unit,
    [unit],
  );

  /** Puts every on/off output back to dark. Safe to call twice. */
  const darken = useCallback((): void => {
    if (lit.current) {
      lit.current = false;
      void torch.setEnabled(false);
    }
    if (surface.current) {
      surface.current = false;
      setScreenLit(false);
    }
  }, [torch]);

  const clearTimers = useCallback((): void => {
    if (ticker.current !== null) clearInterval(ticker.current);
    if (driver.current !== null) clearInterval(driver.current);
    ticker.current = null;
    driver.current = null;
  }, []);

  /** Ends the run and puts every output back to rest. */
  const finish = useCallback((): void => {
    clearTimers();
    darken();
    void audio.stop();
    setPlaying(false);
    setElapsedMs(0);
  }, [audio, clearTimers, darken]);

  const play = useCallback((): void => {
    // Nothing to play, or nothing to play it on. Running anyway would animate
    // a progress bar over an output that is switched off.
    if (timeline.totalUnits === 0) return;
    if (!live.current.sound && !live.current.light && !live.current.screen) return;

    clearTimers();
    startedAt.current = Date.now();
    setPlaying(true);
    setElapsedMs(0);

    // The clock ends the run, not the audio. A muted run has no audio to end
    // it, and the clock is already what the progress bar and the chips follow.
    ticker.current = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      if (elapsed >= durationMs) finish();
      else setElapsedMs(elapsed);
    }, TICK_MS);

    driver.current = setInterval(() => {
      const on = signalAt(changes, elapsedUnits());

      const wantTorch = live.current.light && on;
      if (wantTorch !== lit.current) {
        lit.current = wantTorch;
        void torch.setEnabled(wantTorch);
      }

      const wantSurface = live.current.screen && on;
      if (wantSurface !== surface.current) {
        surface.current = wantSurface;
        setScreenLit(wantSurface);
      }
    }, DRIVE_MS);

    if (live.current.sound) {
      void audio.play(renderWav(timeline, { unitMs: unit }));
    }
  }, [
    audio,
    changes,
    clearTimers,
    durationMs,
    elapsedUnits,
    finish,
    timeline,
    torch,
    unit,
  ]);

  const toggleChannel = useCallback(
    (channel: OutputChannel): void => {
      const next = { ...live.current, [channel]: !live.current[channel] };
      live.current = next;
      setChannels(next);

      // Light and screen need nothing here — the driver reads `live` on its
      // next pass and catches up on its own, whichever way they were switched.
      if (!playing || channel !== 'sound') return;

      if (next.sound) {
        // Join where the others already are, rather than starting again.
        void audio.play(
          renderWav(timelineFrom(timeline, elapsedUnits()), { unitMs: unit }),
        );
      } else {
        void audio.stop();
      }
    },
    [audio, elapsedUnits, playing, timeline, unit],
  );

  const playLetter = useCallback(
    (index: number): void => {
      // Ignored while a message is running. The port plays one thing at a
      // time, so a preview would replace the message mid-transmission — and
      // the letters are a progress display at that moment, not a keyboard.
      if (playing) return;

      const letter = letterAt(message, index);
      if (letter === null || letter.symbols.length === 0) return;

      void audio.play(renderWav(toTimeline(messageOfLetter(letter)), { unitMs: unit }));
    },
    [audio, message, playing, unit],
  );

  // Editing the text mid-playback, or leaving the screen, must not leave a
  // clock running — or, worse, the torch switched on — over a message that is
  // no longer on screen.
  useEffect(() => {
    return () => {
      clearTimers();
      darken();
      void audio.stop();
      setPlaying(false);
      setElapsedMs(0);
    };
  }, [message, audio, clearTimers, darken]);

  return {
    playing,
    soundingIndex: playing ? soundingIndexAt(spans, elapsedMs / unit) : null,
    progress: durationMs === 0 ? 0 : elapsedMs / durationMs,
    elapsedMs,
    durationMs,
    channels,
    screenLit,
    toggleChannel,
    canPlay:
      timeline.totalUnits > 0 && (channels.sound || channels.light || channels.screen),
    play,
    stop: finish,
    playLetter,
  };
}
