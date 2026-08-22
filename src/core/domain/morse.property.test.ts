import fc from 'fast-check';
import {
  SUPPORTED_CHARACTERS,
  decode,
  encode,
  encodeToString,
  normaliseForMorse,
} from './morse';

/** Arbitrary text drawn only from characters the app can represent. */
const supportedText = fc
  .array(fc.constantFrom(...SUPPORTED_CHARACTERS, ' '), { minLength: 0, maxLength: 40 })
  .map((chars) => chars.join(''));

describe('morse properties', () => {
  it('round-trips any supported text through the normalised form', () => {
    fc.assert(
      fc.property(supportedText, (text) => {
        expect(decode(encodeToString(text))).toBe(normaliseForMorse(text));
      }),
    );
  });

  it('round-trips arbitrary unicode too, once normalised', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), (text) => {
        expect(decode(encodeToString(text))).toBe(normaliseForMorse(text));
      }),
    );
  });

  it('never emits an empty letter', () => {
    fc.assert(
      fc.property(supportedText, (text) => {
        for (const word of encode(text).words) {
          for (const letter of word.letters) {
            expect(letter.symbols.length).toBeGreaterThan(0);
          }
        }
      }),
    );
  });

  it('only ever emits dots and dashes', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), (text) => {
        for (const word of encode(text).words) {
          for (const letter of word.letters) {
            for (const symbol of letter.symbols) {
              expect(symbol === '.' || symbol === '-').toBe(true);
            }
          }
        }
      }),
    );
  });

  it('normalisation is idempotent for any input', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), (text) => {
        const once = normaliseForMorse(text);
        expect(normaliseForMorse(once)).toBe(once);
      }),
    );
  });

  it('encoding is invariant under normalisation', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), (text) => {
        expect(encodeToString(normaliseForMorse(text))).toBe(encodeToString(text));
      }),
    );
  });
});
