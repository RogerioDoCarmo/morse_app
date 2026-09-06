import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createRecordingCrashReporter } from '@/testing/recordingCrashReporter';
import type { VibrationMark } from '@/core/ports';
import {
  createPlatformVibrationAdapter,
  toAndroidPattern,
} from './platformVibrationAdapter';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Heavy: 'heavy' },
}));

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

  it('has nothing to play for no marks', () => {
    expect(toAndroidPattern([])).toEqual([]);
  });
});

describe('platformVibrationAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
