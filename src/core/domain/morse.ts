/**
 * Morse encoding and decoding.
 *
 * Pure domain code: no React, no Expo, no I/O. Everything here is a total
 * function over strings, which is what makes it exhaustively unit-, property-
 * and mutation-testable.
 */

/** A single Morse mark. A dot is one unit long, a dash is three. */
export type MorseSymbol = '.' | '-';

/** One character rendered as the marks that spell it. */
export type MorseLetter = Readonly<{
  /** The normalised source character, e.g. `'A'`. */
  char: string;
  /** The marks that spell it, e.g. `['.', '-']`. Never empty. */
  symbols: readonly MorseSymbol[];
}>;

/** One whitespace-delimited word. */
export type MorseWord = Readonly<{ letters: readonly MorseLetter[] }>;

/** A whole encoded message, ready to render, flash, or play. */
export type MorseMessage = Readonly<{ words: readonly MorseWord[] }>;

/**
 * Stands in for a Morse token that maps to no known character.
 *
 * Deliberately not `'?'`: `'?'` is itself encodable (`..--..`), so using it
 * would make a genuine question mark indistinguishable from a decode failure.
 */
export const UNDECODABLE = '�';

/**
 * Characters that survive normalisation with an accent intact.
 *
 * ITU-R M.1677-1 gives these three their own codes, and they are letters in
 * their own right rather than decoration — `año` is not `ano`, and `ação` is
 * not `acao`. Every other diacritic is folded to its base letter, because
 * inventing a code for it would be unreadable to any other operator.
 */
const ACCENTS_WITH_CODES = new Set(['Ç', 'É', 'Ñ']);

/** Character → marks. The single source of truth; the decode table is derived. */
const CHARACTER_TO_CODE: Readonly<Record<string, string>> = Object.freeze({
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  Ç: '-.-..',
  É: '..-..',
  Ñ: '--.--',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',
  '0': '-----',
  '.': '.-.-.-',
  ',': '--..--',
  '?': '..--..',
  "'": '.----.',
  '!': '-.-.--',
  '/': '-..-.',
  '(': '-.--.',
  ')': '-.--.-',
  '&': '.-...',
  ':': '---...',
  ';': '-.-.-.',
  '=': '-...-',
  '+': '.-.-.',
  '-': '-....-',
  _: '..--.-',
  '"': '.-..-.',
  '@': '.--.-.',
});

/** Marks → character. Derived so the two tables cannot drift apart. */
const CODE_TO_CHARACTER: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(CHARACTER_TO_CODE).map(([char, code]) => [code, char]),
  ),
);

/** Separates words in the string form. The character `/` itself is `-..-.`. */
export const WORD_SEPARATOR = '/';

/** Every character this app can encode, normalised and sorted. */
export const SUPPORTED_CHARACTERS: readonly string[] = Object.freeze(
  Object.keys(CHARACTER_TO_CODE),
);

/** Strips combining marks: `'Ã'` → `'A'`. */
const foldDiacritics = (char: string): string =>
  char.normalize('NFD').replace(/[̀-ͯ]/gu, '');

/**
 * Reduces arbitrary text to exactly what {@link encode} can represent.
 *
 * Uppercases, keeps {@link ACCENTS_WITH_CODES} intact, folds every other
 * diacritic to its base letter, drops characters with no code at all, and
 * collapses whitespace runs to a single space.
 *
 * This is the function that makes the round-trip invariant honest:
 * `decode(encodeToString(t)) === normaliseForMorse(t)` holds for **any**
 * string, whereas comparing against `t.toUpperCase()` only holds for input
 * that happened to be plain ASCII already.
 */
export function normaliseForMorse(text: string): string {
  const folded = Array.from(text.normalize('NFC').toUpperCase())
    .map((char) => (ACCENTS_WITH_CODES.has(char) ? char : foldDiacritics(char)))
    .join('');

  return Array.from(folded)
    .map((char) => (/\s/u.test(char) ? ' ' : char in CHARACTER_TO_CODE ? char : ''))
    .join('')
    .replace(/ +/gu, ' ')
    .trim();
}

/**
 * Characters in `text` that Morse cannot carry, each listed once in the order
 * it first appears.
 *
 * {@link normaliseForMorse} drops these, which is the right thing for the
 * encoder — there is no code to emit — but dropping them SILENTLY is not: the
 * reader gets a message with holes in it and the sender is never told. This
 * reports exactly what {@link encode} will discard, so a caller can say so.
 *
 * Whitespace is not dropped, it is collapsed, so it is never reported here.
 * Neither are diacritics that fold onto an encodable letter: `Ã` is sent as
 * `A`, which is a substitution the recipient can read, not a loss. Only what
 * ends up with no code at all is reported, and it is reported as it was typed
 * rather than after folding — the user needs to recognise their own text.
 */
export function unsupportedCharacters(text: string): readonly string[] {
  const seen = new Set<string>();
  const dropped: string[] = [];

  // Uppercased first, exactly as normaliseForMorse does, so a character whose
  // uppercase form IS encodable (ß becomes SS) is not reported as lost.
  Array.from(text.normalize('NFC').toUpperCase()).forEach((char) => {
    if (/\s/u.test(char)) return;

    // A lone combining mark folds away to nothing, and nothing is not a key in
    // the table, so the empty case needs no guard of its own — it falls through
    // and is reported, which is correct: the encoder drops it too.
    const folded = ACCENTS_WITH_CODES.has(char) ? char : foldDiacritics(char);
    if (folded in CHARACTER_TO_CODE) return;
    if (seen.has(char)) return;

    seen.add(char);
    dropped.push(char);
  });

  return dropped;
}

/** Splits a code string into its marks. Assumes the code came from the table. */
const toSymbols = (code: string): readonly MorseSymbol[] =>
  Array.from(code).filter((mark): mark is MorseSymbol => mark === '.' || mark === '-');

/**
 * Encodes text into a structured message.
 *
 * The input is normalised first, so unsupported characters are dropped rather
 * than producing empty letters. Returns no words for input that normalises
 * away to nothing.
 */
export function encode(text: string): MorseMessage {
  const normalised = normaliseForMorse(text);
  if (normalised === '') return { words: [] };

  return {
    words: normalised.split(' ').map((word) => ({
      letters: Array.from(word).map((char) => ({
        char,
        symbols: toSymbols(CHARACTER_TO_CODE[char] ?? ''),
      })),
    })),
  };
}

/**
 * Encodes text into the canonical string form — marks separated by one space,
 * words by `' / '`.
 */
export function encodeToString(text: string): string {
  return encode(text)
    .words.map((word) => word.letters.map((letter) => letter.symbols.join('')).join(' '))
    .join(` ${WORD_SEPARATOR} `);
}

/**
 * Decodes the string form back to text.
 *
 * Tolerant on the way in: any whitespace run separates letters, and a word
 * break may be written either as `/` or as a run of three or more spaces —
 * both are in the wild, and a human tapping one out will produce the latter.
 * Tokens matching no character decode to {@link UNDECODABLE}.
 */
export function decode(morse: string): string {
  const words = morse
    .trim()
    .split(/\s*\/\s*|\s{3,}/u)
    .filter((word) => word.trim() !== '');

  return words
    .map((word) =>
      word
        .trim()
        .split(/\s+/u)
        .filter((token) => token !== '')
        .map((token) => CODE_TO_CHARACTER[token] ?? UNDECODABLE)
        .join(''),
    )
    .filter((word) => word !== '')
    .join(' ');
}
