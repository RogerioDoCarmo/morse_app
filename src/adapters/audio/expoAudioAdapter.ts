import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import type { IAudioPlaybackPort, ICrashReportingPort } from '@/core/ports';

/** Non-Error throws are legal in JS; reports need a stack either way. */
const asError = (thrown: unknown): Error =>
  thrown instanceof Error ? thrown : new Error(String(thrown));

/** Everything one playback owns, so ending it releases all of it. */
type Session = Readonly<{
  player: AudioPlayer;
  file: File;
  subscription: { remove: () => void };
  resolve: () => void;
}>;

/**
 * Plays Morse audio through expo-audio.
 *
 * The bytes are written to a cache file and handed to the player as a URI:
 * expo-audio loads a source, not a buffer, and the cache is the right home for
 * something the system may reclaim at will.
 *
 * Takes {@link ICrashReportingPort} — the interface, not the Firebase adapter,
 * so this file never learns that Firebase exists and its tests stay free of it.
 */
export function createExpoAudioAdapter(crash: ICrashReportingPort): IAudioPlaybackPort {
  /** The one playback in flight, if any. */
  let active: Session | null = null;
  /** Names each clip apart, so a lingering player never reads a rewritten file. */
  let sequence = 0;

  function release(session: Session): void {
    try {
      session.subscription.remove();
      session.player.remove();
    } catch (error) {
      void crash.recordError(asError(error), 'audio: releasing the player failed');
    }

    try {
      session.file.delete();
    } catch (error) {
      // Harmless on its own — the system reclaims the cache — but a clip that
      // will not delete usually means the player never let go of it.
      void crash.recordError(asError(error), 'audio: deleting the clip failed');
    }
  }

  /** Ends the active playback and releases whoever is awaiting it. */
  function finish(): void {
    const session = active;
    if (session === null) return;

    active = null;
    release(session);
    session.resolve();
  }

  return {
    async play(wav) {
      // A second message replaces the first rather than overlapping it. Two
      // Morse signals at once are unreadable.
      finish();

      let file: File;
      let player: AudioPlayer;

      try {
        // The user pressed play. A silent switch should not swallow the
        // message they explicitly asked to hear.
        await setAudioModeAsync({ playsInSilentMode: true });

        sequence += 1;
        file = new File(Paths.cache, `morse-${sequence}.wav`);
        // Overwrite: `sequence` restarts at zero on a cold launch, so a clip
        // from a previous run can still be sitting there.
        file.create({ overwrite: true });
        file.write(wav);
        player = createAudioPlayer(file.uri);
      } catch (error) {
        // Resolves rather than rejecting: a caller awaiting playback must not
        // hang because the clip could not be prepared.
        await crash.recordError(asError(error), 'audio: preparing the clip failed');
        return;
      }

      return new Promise<void>((resolve) => {
        const subscription = player.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish) finish();
        });

        active = { player, file, subscription, resolve };

        try {
          player.play();
        } catch (error) {
          void crash.recordError(asError(error), 'audio: starting playback failed');
          finish();
        }
      });
    },

    stop() {
      finish();
      return Promise.resolve();
    },
  };
}
