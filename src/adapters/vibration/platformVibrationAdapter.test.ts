import { Platform, Vibration } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as Haptics from 'expo-haptics';
import { createRecordingCrashReporter } from '@/testing/recordingCrashReporter';
import type { VibrationMark } from '@/core/ports';
import { encode } from '@/core/domain/morse';
import { signalMarks, toTimeline, unitMsForWpm } from '@/core/domain/timeline';
import {
  createPlatformVibrationAdapter,
  toAndroidPattern,
} from './platformVibrationAdapter';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Heavy: 'heavy' },
}));

// The local Android module. Absent by default, which is exactly what a build
// without it — or iOS, or this test runner — sees.
jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn(() => null) }));
const mockRequireModule = jest.mocked(requireOptionalNativeModule);

/** A stand-in for `modules/morse-vibration`, and what it did. */
const nativeModule = (
  played: boolean,
): { vibratePattern: jest.Mock; cancelVibration: jest.Mock } => ({
  vibratePattern: jest.fn(() => played),
  cancelVibration: jest.fn(),
});

const marks: VibrationMark[] = [
  { atMs: 0, durationMs: 120, long: false },
  { atMs: 240, durationMs: 360, long: true },
];

const onPlatform = (os: 'ios' | 'android'): void => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
};

describe('toAndroidPattern', () => {
  // Android's form: a delay, then alternating buzz and silence.
  it('turns marks into a delay-then-alternating pattern', () => {
    expect(toAndroidPattern(marks)).toEqual([0, 120, 120, 360]);
  });

  it('opens with the wait before the first mark', () => {
    expect(toAndroidPattern([{ atMs: 500, durationMs: 120, long: false }])).toEqual([
      500, 120,
    ]);
  });

  // Joining a run in progress produces marks that start part-way through, and
  // the gaps between them are what matters, not their absolute times.
  it('keeps the gaps right for marks that start part-way through', () => {
    expect(
      toAndroidPattern([
        { atMs: 1000, durationMs: 120, long: false },
        { atMs: 1240, durationMs: 120, long: false },
      ]),
    ).toEqual([1000, 120, 120, 120]);
  });

  /**
   * ⚠️ These are the shape React Native's Android module REQUIRES, not a
   * preference. `VibrationModule.kt` does:
   *
   *     patternLong[i] = pattern.getInt(i).toLong()
   *     v.vibrate(VibrationEffect.createWaveform(patternLong, repeat))
   *
   * `getInt` wants integers, and `createWaveform` rejects an empty array and
   * one that is entirely zeroes. Written down here because a Poco X5 5G did
   * not vibrate at all on the first build anyone ran, and ruling this side out
   * was half the investigation — the pattern is correct at every speed the
   * app offers, so the fault is not here.
   */
  it.each([5, 10, 15])(
    'gives Android a waveform it will accept at %i wpm',
    (wordsPerMinute) => {
      const unit = unitMsForWpm(wordsPerMinute);
      const pattern = toAndroidPattern(
        signalMarks(toTimeline(encode('SOS'))).map((mark) => ({
          atMs: mark.atUnit * unit,
          durationMs: mark.units * unit,
          long: mark.long,
        })),
      );

      expect(pattern.length).toBeGreaterThan(0);
      expect(pattern.every(Number.isInteger)).toBe(true);
      expect(pattern.every((entry) => entry >= 0)).toBe(true);
      expect(pattern.some((entry) => entry > 0)).toBe(true);
      // Delay, duration, delay, duration — an even count, opening with a wait.
      expect(pattern.length % 2).toBe(0);
    },
  );

  it('has nothing to play for no marks', () => {
    expect(toAndroidPattern([])).toEqual([]);
  });
});

describe('platformVibrationAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireModule.mockReturnValue(null);
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    onPlatform('ios');
  });

  it('hands Android the whole pattern in one call, so the OS keeps the rhythm', async () => {
    onPlatform('android');
    const vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);

    await createPlatformVibrationAdapter(createRecordingCrashReporter()).play(marks);

    expect(vibrate).toHaveBeenCalledWith([0, 120, 120, 360], false);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  /**
   * The defect three builds were spent on. React Native's Vibration states no
   * usage, so Android treats the buzz as touch feedback and drops it outright
   * when that intensity is turned down — silently, with nothing to catch. The
   * local module is the only caller here that says what the vibration is for,
   * so it has to be the one that gets asked first.
   */
  it('prefers the module that can state a usage the OS will not suppress', async () => {
    onPlatform('android');
    const native = nativeModule(true);
    mockRequireModule.mockReturnValue(native);
    const vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);

    await createPlatformVibrationAdapter(createRecordingCrashReporter()).play(marks);

    expect(native.vibratePattern).toHaveBeenCalledWith([0, 120, 120, 360]);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('falls back to React Native when the module is not in this build', async () => {
    onPlatform('android');
    mockRequireModule.mockReturnValue(null);
    const vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);

    await createPlatformVibrationAdapter(createRecordingCrashReporter()).play(marks);

    expect(vibrate).toHaveBeenCalledWith([0, 120, 120, 360], false);
  });

  // A device with no motor at all answers false. Falling back then costs
  // nothing and keeps one answer — "it did not play" — from meaning two
  // different things.
  it('falls back when the module says it played nothing', async () => {
    onPlatform('android');
    const native = nativeModule(false);
    mockRequireModule.mockReturnValue(native);
    const vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);

    await createPlatformVibrationAdapter(createRecordingCrashReporter()).play(marks);

    expect(native.vibratePattern).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith([0, 120, 120, 360], false);
  });

  it('leaves the Android module alone on iOS', async () => {
    onPlatform('ios');
    const native = nativeModule(true);
    mockRequireModule.mockReturnValue(native);

    const port = createPlatformVibrationAdapter(createRecordingCrashReporter());
    await port.play(marks);
    await port.stop();

    expect(native.vibratePattern).not.toHaveBeenCalled();
    expect(native.cancelVibration).not.toHaveBeenCalled();
  });

  // Whichever one started the run has to be the one that can end it, and the
  // adapter does not track which that was.
  it('stops both engines on Android, since either could be the one running', async () => {
    onPlatform('android');
    const native = nativeModule(true);
    mockRequireModule.mockReturnValue(native);
    const cancel = jest.spyOn(Vibration, 'cancel').mockImplementation(() => undefined);

    await createPlatformVibrationAdapter(createRecordingCrashReporter()).stop();

    expect(native.cancelVibration).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  // iOS cannot vary the length of a vibration, so the difference between a dot
  // and a dash moves into intensity and the rhythm is carried by the timing.
  it('fires an iOS pulse at each mark, heavy for a dash and light for a dot', async () => {
    onPlatform('ios');
    await createPlatformVibrationAdapter(createRecordingCrashReporter()).play(marks);

    expect(Haptics.impactAsync).not.toHaveBeenCalled();

    jest.advanceTimersByTime(10);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');

    jest.advanceTimersByTime(240);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('heavy');
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
  });

  it('cancels iOS pulses that have not fired yet', async () => {
    onPlatform('ios');
    const port = createPlatformVibrationAdapter(createRecordingCrashReporter());

    await port.play(marks);
    jest.advanceTimersByTime(10);
    await port.stop();
    jest.advanceTimersByTime(1000);

    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  it('replaces a run in progress rather than layering a second one over it', async () => {
    onPlatform('ios');
    const port = createPlatformVibrationAdapter(createRecordingCrashReporter());

    await port.play(marks);
    await port.play([{ atMs: 0, durationMs: 120, long: false }]);
    jest.advanceTimersByTime(1000);

    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  it('has nothing to do for no marks', async () => {
    onPlatform('android');
    const vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);

    await createPlatformVibrationAdapter(createRecordingCrashReporter()).play([]);

    expect(vibrate).not.toHaveBeenCalled();
  });

  // A message that will not play because the motor refused is worse than one
  // that plays without it.
  it('reports a motor it could not start, and carries on', async () => {
    onPlatform('android');
    jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {
      throw new Error('no motor');
    });
    const crash = createRecordingCrashReporter();

    await expect(
      createPlatformVibrationAdapter(crash).play(marks),
    ).resolves.toBeUndefined();
    expect(crash.reports).toEqual([
      { message: 'no motor', context: 'vibration: could not start' },
    ]);
  });

  it('reports a motor it could not stop', async () => {
    jest.spyOn(Vibration, 'cancel').mockImplementation(() => {
      throw new Error('stuck');
    });
    const crash = createRecordingCrashReporter();

    await expect(createPlatformVibrationAdapter(crash).stop()).resolves.toBeUndefined();
    expect(crash.reports).toEqual([
      { message: 'stuck', context: 'vibration: could not stop' },
    ]);
  });
});
