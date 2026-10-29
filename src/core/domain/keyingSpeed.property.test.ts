import fc from 'fast-check';
import { SUPPORTED_CHARACTERS, encode } from './morse';
import { keyedWpm } from './keyingSpeed';
import type { TapPress } from './tapping';

/**
 * Keys a message with a perfectly steady fist: every mark and every silence
 * inside a letter an exact multiple of `unitMs`, and the gaps between letters
 * and words `stretch` times as long as the decoder needs.
 *
 * The cut-off this is read against is 2 × `unitMs`, so a dot (1) sits below it
 * and a dash (3) above. ⚠️ That doubles the gaps the decoder asks for too: a
 * letter needs 3 cut-offs (6 units) of silence and a word 7 (14), and the
 * textbook 3 and 7 units would be read as silences inside the letter.
 */
function steady(text: string, unitMs: number, stretch: number): TapPress[] {
  const presses: TapPress[] = [];

  encode(text).words.forEach((word) => {
    word.letters.forEach((letter, letterIndex) => {
      letter.symbols.forEach((symbol, symbolIndex) => {
        const gapMs =
          presses.length === 0
            ? 0
            : symbolIndex > 0
              ? unitMs
              : unitMs * (letterIndex > 0 ? 6 : 14) * stretch;
        presses.push({
          durationMs: unitMs * (symbol === '.' ? 1 : 3),
          gapBeforeMs: gapMs,
        });
      });
    });
  });

  return presses;
}

const text = fc
  .array(fc.constantFrom(...SUPPORTED_CHARACTERS, ' '), { minLength: 1, maxLength: 24 })
  .map((chars) => chars.join(''))
  .filter((chars) => encode(chars).words.length > 0);

// 40..200ms keeps the 2× cut-off inside the 80..400ms the settings allow.
const unit = fc.integer({ min: 40, max: 200 });

describe('keying speed properties', () => {
  it('reads a steady fist at exactly the speed it keyed', () => {
    fc.assert(
      fc.property(text, unit, (message, unitMs) => {
        expect(keyedWpm(steady(message, unitMs, 1), unitMs * 2)).toBe(
          Math.round(1200 / unitMs),
        );
      }),
    );
  });

  it('is not slowed by pausing between letters and words', () => {
    fc.assert(
      fc.property(text, unit, fc.integer({ min: 1, max: 20 }), (message, unitMs, k) => {
        expect(keyedWpm(steady(message, unitMs, k), unitMs * 2)).toBe(
          keyedWpm(steady(message, unitMs, 1), unitMs * 2),
        );
      }),
    );
  });
});
