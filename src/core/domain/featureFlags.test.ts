import {
  DISABLED_OUTPUT_CHANNELS,
  DISABLED_PLAYBACK_WPM,
  OUTPUT_CHANNELS,
  enabledOutputChannels,
  enabledPlaybackWpm,
  isOutputChannelEnabled,
  isPlaybackWpmEnabled,
} from './featureFlags';
import { PLAYBACK_WPM_CHOICES } from './timeline';

describe('feature flags', () => {
  /**
   * ⚠️ BOTH LISTS ARE EMPTY, and this test is what keeps a flag from being
   * left on by accident. A switch flipped to contain a defect is meant to come
   * back off once the defect is fixed; without something failing, "temporarily
   * disabled" quietly becomes "removed".
   *
   * If you are here because this test failed after deliberately disabling
   * something: say so in the expectation, and say when it comes back.
   */
  it('ships with nothing withheld', () => {
    expect(DISABLED_PLAYBACK_WPM).toStrictEqual([]);
    expect(DISABLED_OUTPUT_CHANNELS).toStrictEqual([]);
  });

  it('offers every speed and every channel while nothing is withheld', () => {
    expect(enabledPlaybackWpm()).toStrictEqual([5, 10, 15]);
    expect(enabledOutputChannels()).toStrictEqual(['sound', 'light', 'screen', 'buzz']);
  });

  // The canonical lists are what the flags subtract from, so they have to be
  // the lists the rest of the app uses.
  it('subtracts from the lists the app actually offers', () => {
    expect(enabledPlaybackWpm()).toStrictEqual(PLAYBACK_WPM_CHOICES);
    expect(OUTPUT_CHANNELS).toHaveLength(4);
  });

  it.each([5, 10, 15])('%i wpm is enabled', (wpm) => {
    expect(isPlaybackWpmEnabled(wpm)).toBe(true);
  });

  it('does not enable a speed the app has never offered', () => {
    expect(isPlaybackWpmEnabled(7)).toBe(false);
    expect(isPlaybackWpmEnabled(Number.NaN)).toBe(false);
  });

  it.each(OUTPUT_CHANNELS)('%s is enabled', (channel) => {
    expect(isOutputChannelEnabled(channel)).toBe(true);
  });
});

/**
 * ⚠️ THE PART THAT ACTUALLY MATTERS. Asserting the defaults only proves
 * nothing is withheld today; it says nothing about whether withholding works.
 * These exercise the mechanism on the day someone reaches for it in a hurry.
 */
describe('withholding something', () => {
  it('removes a disabled speed and keeps the rest', () => {
    expect(enabledPlaybackWpm([10])).toStrictEqual([5, 15]);
  });

  it('removes a disabled channel and keeps the rest', () => {
    expect(enabledOutputChannels(['light'])).toStrictEqual(['sound', 'screen', 'buzz']);
  });

  /**
   * ⚠️ Disabling everything gives everything back, deliberately. An empty
   * picker is a Settings screen with a blank row, and no channels at all is an
   * Emit button permanently disabled with nothing on screen to explain why —
   * both worse than the defect the flag was reached for.
   */
  it('refuses to withhold every speed', () => {
    expect(enabledPlaybackWpm([5, 10, 15])).toStrictEqual([5, 10, 15]);
  });

  it('refuses to withhold every channel', () => {
    expect(enabledOutputChannels(['sound', 'light', 'screen', 'buzz'])).toStrictEqual([
      'sound',
      'light',
      'screen',
      'buzz',
    ]);
  });

  it('ignores a name that is not offered anyway', () => {
    expect(enabledPlaybackWpm([7])).toStrictEqual([5, 10, 15]);
  });
});
