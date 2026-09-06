/*
 * The "render" here is audio rendering, not React Testing Library's. The rule
 * detects `wav` as a wrapper around a `render*` function by name alone and
 * demands the result be called `view` or `utils`, which would be nonsense for
 * a buffer of PCM bytes.
 */
/* eslint-disable testing-library/render-result-naming-convention */
import { encode } from './morse';
import { MIN_UNIT_MS } from './tapping';
import { DEFAULT_PLAYBACK_UNIT_MS } from './timeline';
import { toTimeline, totalMs } from './timeline';
import {
  DEFAULT_SAMPLE_RATE,
  DEFAULT_TONE_HZ,
  renderWav,
  type ToneOptions,
} from './tone';

const HEADER_BYTES = 44;

const wav = (text: string, options: ToneOptions = {}): Uint8Array =>
  renderWav(toTimeline(encode(text)), options);

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  Array.from(bytes.slice(start, start + length))
    .map((byte) => String.fromCharCode(byte))
    .join('');

/** Folded, not spread: a long message is hundreds of thousands of samples. */
const maxOf = (values: number[]): number =>
  values.reduce((best, value) => (value > best ? value : best), -Infinity);
const minOf = (values: number[]): number =>
  values.reduce((best, value) => (value < best ? value : best), Infinity);

const view = (bytes: Uint8Array): DataView =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

/** The 16-bit little-endian samples that follow the header. */
const samplesOf = (bytes: Uint8Array): number[] => {
  const data = view(bytes);
  const count = (bytes.length - HEADER_BYTES) / 2;
  return Array.from({ length: count }, (_, index) =>
    data.getInt16(HEADER_BYTES + index * 2, true),
  );
};

describe('renderWav header', () => {
  it('writes a canonical RIFF/WAVE header', () => {
    const bytes = wav('E');

    expect(ascii(bytes, 0, 4)).toBe('RIFF');
    expect(ascii(bytes, 8, 4)).toBe('WAVE');
    expect(ascii(bytes, 12, 4)).toBe('fmt ');
    expect(ascii(bytes, 36, 4)).toBe('data');
  });

  it('declares mono 16-bit uncompressed PCM', () => {
    const data = view(wav('E'));

    expect(data.getUint32(16, true)).toBe(16); // fmt chunk length
    expect(data.getUint16(20, true)).toBe(1); // PCM
    expect(data.getUint16(22, true)).toBe(1); // channels
    expect(data.getUint16(32, true)).toBe(2); // block align
    expect(data.getUint16(34, true)).toBe(16); // bits per sample
  });

  it('declares the sample and byte rates it was rendered at', () => {
    const data = view(wav('E', { sampleRate: 16000 }));

    expect(data.getUint32(24, true)).toBe(16000);
    expect(data.getUint32(28, true)).toBe(32000); // 2 bytes per sample
  });

  it('declares sizes that match the buffer it returned', () => {
    const bytes = wav('SOS');
    const data = view(bytes);

    expect(data.getUint32(4, true)).toBe(bytes.length - 8);
    expect(data.getUint32(40, true)).toBe(bytes.length - HEADER_BYTES);
  });
});

describe('renderWav audio', () => {
  it('renders a valid silent file for an empty message', () => {
    const bytes = wav('');

    expect(bytes.length).toBe(HEADER_BYTES);
    expect(ascii(bytes, 0, 4)).toBe('RIFF');
    expect(view(bytes).getUint32(40, true)).toBe(0);
  });

  it('lasts as long as the timeline says it should', () => {
    const timeline = toTimeline(encode('SOS'));
    const bytes = renderWav(timeline, { unitMs: 100, sampleRate: 8000 });

    // 27 units at 100ms is 2.7s, and 2.7s at 8kHz is 21600 samples.
    expect(totalMs(timeline, 100)).toBe(2700);
    expect(samplesOf(bytes)).toHaveLength(21600);
  });

  it('is silent exactly where the timeline is silent', () => {
    // A is dot(1) gap(1) dash(3), so at 100ms and 1000Hz the middle 100
    // samples are the gap.
    const samples = samplesOf(
      renderWav(toTimeline(encode('A')), { unitMs: 100, sampleRate: 1000 }),
    );

    expect(samples).toHaveLength(500);
    expect(samples.slice(100, 200).every((sample) => sample === 0)).toBe(true);
    expect(samples.slice(200, 500).some((sample) => sample !== 0)).toBe(true);
  });

  it('starts and ends near silence so the tone does not click', () => {
    const samples = samplesOf(wav('T', { unitMs: 100 }));

    expect(samples[0]).toBe(0);
    expect(samples[samples.length - 1]).toBe(0);
    expect(maxOf(samples.map((sample) => Math.abs(sample)))).toBeGreaterThan(1000);
  });

  // sampleRate 1000 with a 250Hz tone makes the sine land on exactly 0, 1, 0,
  // -1 at successive samples, which isolates the envelope from the waveform.
  // At that rate the 5ms ramp is exactly 5 samples, and a dash is 300.
  describe('envelope', () => {
    const dash = (): number[] =>
      samplesOf(wav('T', { unitMs: 100, sampleRate: 1000, frequencyHz: 250 }));

    // 0.8 * 32767, the peak amplitude, scaled by index/5 across the ramp.
    it('fades in across exactly one ramp', () => {
      const samples = dash();

      expect(samples[0]).toBe(0); // 0/5
      expect(samples[1]).toBe(5243); // 1/5 of peak
      expect(samples[3]).toBe(-15728); // 3/5, on the falling half of the sine
    });

    it('reaches full amplitude once the ramp is over', () => {
      expect(dash()[5]).toBe(26214);
    });

    it('fades out across exactly one ramp', () => {
      const samples = dash();

      expect(samples[295]).toBe(-20971); // 4/5
      expect(samples[297]).toBe(10485); // 2/5
      expect(samples[299]).toBe(0); // 0/5
    });

    // The tests above sit at sine peaks, where multiplying by the envelope and
    // dividing by it happen to agree. 125Hz lands on ±√2/2 instead, which tells
    // the two apart: at full amplitude the sample is 0.8 * 32767 * -0.7071.
    it('scales the waveform rather than dividing by it', () => {
      const samples = samplesOf(
        wav('T', { unitMs: 100, sampleRate: 1000, frequencyHz: 125 }),
      );

      expect(samples[5]).toBe(-18536);
    });

    it('plays flat where the sample rate is too low to fade', () => {
      // At 50Hz the 5ms ramp rounds to zero samples.
      const samples = samplesOf(
        wav('T', { unitMs: 100, sampleRate: 50, frequencyHz: 12.5 }),
      );

      expect(samples).toHaveLength(15);
      expect(samples[1]).toBe(26214); // full amplitude immediately
    });
  });

  it('keeps every sample inside 16-bit range', () => {
    const samples = samplesOf(wav('HELLO WORLD'));

    expect(maxOf(samples)).toBeLessThanOrEqual(32767);
    expect(minOf(samples)).toBeGreaterThanOrEqual(-32768);
  });

  it('renders a higher pitch as more zero crossings', () => {
    const countCrossings = (samples: number[]): number =>
      samples.filter(
        (sample, index) => index > 0 && sample >= 0 !== (samples[index - 1] ?? 0) >= 0,
      ).length;

    const low = samplesOf(wav('T', { frequencyHz: 400, unitMs: 200 }));
    const high = samplesOf(wav('T', { frequencyHz: 800, unitMs: 200 }));

    expect(countCrossings(high)).toBeGreaterThan(countCrossings(low));
  });

  it('holds an out-of-range speed inside the settings range', () => {
    const fast = wav('E', { unitMs: 1, sampleRate: 1000 });

    // Clamped to MIN_UNIT_MS, so one unit is that many milliseconds.
    expect(samplesOf(fast)).toHaveLength(MIN_UNIT_MS);
  });

  // Not the tap threshold: playback has its own, faster default.
  it('defaults to the playback speed', () => {
    // One dot at 120ms, sampled at 8kHz.
    expect(DEFAULT_PLAYBACK_UNIT_MS).toBe(120);
    expect(samplesOf(wav('E'))).toHaveLength(960);
  });

  it('defaults to the standard sidetone and sample rate', () => {
    const data = view(wav('E'));

    expect(data.getUint32(24, true)).toBe(DEFAULT_SAMPLE_RATE);
    expect(DEFAULT_TONE_HZ).toBe(600);
    expect(DEFAULT_SAMPLE_RATE).toBe(8000);
  });
});
