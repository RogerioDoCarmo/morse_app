/**
 * Rendering a Morse timeline as audio samples.
 *
 * Pure domain code: this produces the BYTES of a WAV file and never touches a
 * speaker, a file system or an Expo module. Playing or saving the result is an
 * adapter's job.
 *
 * The whole message is synthesised as one buffer rather than scheduling a beep
 * per mark. Two reasons: a scheduled sequence drifts, because every timer in
 * React Native is best-effort and the error accumulates over a long message;
 * and rendering it up front is what makes the file saveable, which is the
 * behaviour that prompted this feature.
 */
import { DEFAULT_UNIT_MS, clampUnitMs } from './tapping';
import { toTimedSegments, type MorseTimeline } from './timeline';

/** A WAV header is exactly this long for 16-bit PCM with no extra chunks. */
const HEADER_BYTES = 44;

/** Bytes per sample. 16-bit PCM, the format every platform plays natively. */
const BYTES_PER_SAMPLE = 2;

/** Loudest a sample may be, leaving headroom so nothing clips. */
const PEAK_AMPLITUDE = 0.8 * 0x7fff;

/**
 * The conventional CW sidetone. Operators have listened to roughly this pitch
 * for a century, and it sits where small phone speakers are most efficient.
 */
export const DEFAULT_TONE_HZ = 600;

/**
 * 8 kHz carries a 600 Hz sine with room to spare and keeps a saved message
 * small — a minute of Morse is under a megabyte.
 */
export const DEFAULT_SAMPLE_RATE = 8000;

/**
 * Fade applied to each end of every tone.
 *
 * Starting a sine at full amplitude produces an audible click, because the
 * waveform steps discontinuously from silence. Five milliseconds is short
 * enough to leave the shortest dot recognisable and long enough to remove it.
 */
const RAMP_MS = 5;

/** How to render. Every field has a sensible default. */
export type ToneOptions = Readonly<{
  /** Dot length. Clamped to the range the settings screen offers. */
  unitMs?: number;
  /** Pitch of the tone. */
  frequencyHz?: number;
  /** Samples per second. */
  sampleRate?: number;
}>;

/** Number of samples a stretch of milliseconds occupies. */
const samplesFor = (ms: number, sampleRate: number): number =>
  Math.round((ms * sampleRate) / 1000);

/** Writes `text` as ASCII at `offset`. WAV chunk ids are all four-char ASCII. */
function writeAscii(view: DataView, offset: number, text: string): void {
  Array.from(text).forEach((char, index) => {
    view.setUint8(offset + index, char.charCodeAt(0));
  });
}

/** Fills in the 44-byte canonical WAV header for mono 16-bit PCM. */
function writeHeader(view: DataView, sampleRate: number, sampleCount: number): void {
  const dataBytes = sampleCount * BYTES_PER_SAMPLE;

  writeAscii(view, 0, 'RIFF');
  // Everything after this field, i.e. the whole file minus 'RIFF' and itself.
  view.setUint32(4, HEADER_BYTES - 8 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');

  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk length
  view.setUint16(20, 1, true); // 1 = uncompressed PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * BYTES_PER_SAMPLE, true); // byte rate
  view.setUint16(32, BYTES_PER_SAMPLE, true); // block align
  view.setUint16(34, 8 * BYTES_PER_SAMPLE, true); // bits per sample

  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);
}

/**
 * Amplitude envelope at `index` within a tone of `length` samples.
 *
 * Ramps up over the first {@link RAMP_MS} and down over the last.
 *
 * The two ramps cannot meet in the middle: the shortest tone is a dot, and
 * `renderWav` clamps the unit to at least MIN_UNIT_MS — 80ms against a
 * 5ms ramp, so even the shortest dot is sixteen ramps long, at every sample
 * rate. A guard for the overlapping case would be unreachable code.
 *
 * `ramp` is zero below a ~100Hz sample rate, where 5ms rounds to no samples at
 * all. Neither branch fires then and the tone plays flat, which is correct: at
 * that rate there is nothing to fade.
 */
function envelope(index: number, length: number, sampleRate: number): number {
  const ramp = samplesFor(RAMP_MS, sampleRate);

  // Stryker disable next-line EqualityOperator: `<=` is an equivalent mutant.
  // At index === ramp this returns ramp/ramp, and falling through returns 1.
  if (index < ramp) return index / ramp;
  if (index >= length - ramp) return (length - 1 - index) / ramp;
  return 1;
}

/**
 * Renders a timeline as a complete WAV file.
 *
 * Returns the bytes; an empty timeline still yields a valid, silent file
 * rather than an empty buffer, so callers never have to special-case it.
 */
export function renderWav(
  timeline: MorseTimeline,
  options: ToneOptions = {},
): Uint8Array {
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const frequencyHz = options.frequencyHz ?? DEFAULT_TONE_HZ;
  const unitMs = clampUnitMs(options.unitMs ?? DEFAULT_UNIT_MS);

  const segments = toTimedSegments(timeline, unitMs).map((segment) => ({
    on: segment.on,
    samples: samplesFor(segment.ms, sampleRate),
  }));

  const sampleCount = segments.reduce((sum, segment) => sum + segment.samples, 0);
  const bytes = new Uint8Array(HEADER_BYTES + sampleCount * BYTES_PER_SAMPLE);
  const view = new DataView(bytes.buffer);

  writeHeader(view, sampleRate, sampleCount);

  let offset = HEADER_BYTES;
  segments.forEach((segment) => {
    for (let index = 0; index < segment.samples; index += 1) {
      const value = segment.on
        ? Math.round(
            PEAK_AMPLITUDE *
              envelope(index, segment.samples, sampleRate) *
              Math.sin((2 * Math.PI * frequencyHz * index) / sampleRate),
          )
        : 0;
      view.setInt16(offset, value, true);
      offset += BYTES_PER_SAMPLE;
    }
  });

  return bytes;
}
