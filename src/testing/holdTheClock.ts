/**
 * Stops the wall clock and nothing else.
 *
 * ⚠️ The playback hook ends a run by `Date.now()`, not by the audio, so a test
 * that asserts on the PLAYING state with real timers is racing the message
 * itself. "HI" is about a second and a half at the default speed and SOS about
 * three; under a full parallel run such a test finds the message already over,
 * a different one each time, and the pre-push hook refuses the push. Timers
 * still run, so effects and `waitFor` behave as before — only the clock the
 * run is measured by stands still.
 *
 * A file that calls this must restore real timers in an `afterEach`, so a test
 * that held the clock and then failed does not hand the frozen clock on.
 */
export const holdTheClock = (): void => {
  jest.useFakeTimers({
    doNotFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'nextTick',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'hrtime',
      'performance',
    ],
  });
};
