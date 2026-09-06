import fc from 'fast-check';
import { SUPPORTED_CHARACTERS, encode, normaliseForMorse } from './morse';
import { decodeTaps, type TapPress } from './tapping';

/** Taps a message out at a given unit length, the way a tidy operator would. */
function tapsFor(text: string, unitMs: number): TapPress[] {
  const presses: TapPress[] = [];

  encode(text).words.forEach((word, wordIndex) => {
    word.letters.forEach((letter, letterIndex) => {
      letter.symbols.forEach((symbol, symbolIndex) => {
        const gapUnits =
          presses.length === 0 ? 0 : symbolIndex > 0 ? 1 : letterIndex > 0 ? 3 : 7;
        presses.push({
          durationMs: symbol === '.' ? unitMs * 0.5 : unitMs * 2,
          gapBeforeMs: unitMs * gapUnits,
        });
      });
    });
    void wordIndex;
  });

  return presses;
}

const supportedText = fc
  .array(fc.constantFrom(...SUPPORTED_CHARACTERS, ' '), { minLength: 1, maxLength: 24 })
  .map((chars) => chars.join(''));

describe('tap decoding properties', () => {
  it('reads back anything tapped cleanly, at any cut-off in range', () => {
    fc.assert(
      fc.property(supportedText, fc.integer({ min: 80, max: 400 }), (text, unit) => {
        expect(decodeTaps(tapsFor(text, unit), unit)).toBe(normaliseForMorse(text));
      }),
    );
  });

  it('is invariant to the operator speed, as long as the cut-off matches it', () => {
    fc.assert(
      fc.property(supportedText, (text) => {
        const slow = decodeTaps(tapsFor(text, 400), 400);
        const fast = decodeTaps(tapsFor(text, 80), 80);
        expect(slow).toBe(fast);
      }),
    );
  });
});
