import {
  SUPPORTED_CHARACTERS,
  UNDECODABLE,
  decode,
  encode,
  encodeToString,
  letterAt,
  messageOfLetter,
  normaliseForMorse,
  unsupportedCharacters,
} from './morse';

describe('normaliseForMorse', () => {
  it('uppercases', () => {
    expect(normaliseForMorse('hello')).toBe('HELLO');
  });

  it.each([
    ['Ç', 'AÇÃO', 'AÇAO'],
    ['Ñ', 'año', 'AÑO'],
    ['É', 'café', 'CAFÉ'],
  ])('keeps %s, which has an ITU code of its own', (_label, input, expected) => {
    expect(normaliseForMorse(input)).toBe(expected);
  });

  it.each([
    ['ã', 'irmã', 'IRMA'],
    ['õ', 'ações', 'AÇOES'],
    ['ê', 'você', 'VOCE'],
    ['á', 'está', 'ESTA'],
    ['ü', 'pingüino', 'PINGUINO'],
  ])('folds %s, which has none', (_label, input, expected) => {
    expect(normaliseForMorse(input)).toBe(expected);
  });

  it('drops characters with no code at all', () => {
    expect(normaliseForMorse('a★b')).toBe('AB');
  });

  it('collapses whitespace runs and trims', () => {
    expect(normaliseForMorse('  a \t\n b  ')).toBe('A B');
  });

  it('is idempotent', () => {
    const once = normaliseForMorse('  Ação  do  café  ');
    expect(normaliseForMorse(once)).toBe(once);
  });
});

describe('encodeToString', () => {
  it('separates letters with one space and words with a slash', () => {
    expect(encodeToString('HELLO WORLD')).toBe(
      '.... . .-.. .-.. --- / .-- --- .-. .-.. -..',
    );
  });

  it('encodes SOS', () => {
    expect(encodeToString('SOS')).toBe('... --- ...');
  });

  it('encodes the accented letters with their own codes', () => {
    expect(encodeToString('ÇÉÑ')).toBe('-.-.. ..-.. --.--');
  });

  it('encodes digits', () => {
    expect(encodeToString('2026')).toBe('..--- ----- ..--- -....');
  });

  it('returns an empty string for input that normalises away', () => {
    expect(encodeToString('★ ★')).toBe('');
  });
});

describe('encode', () => {
  it('groups letters into words', () => {
    const message = encode('AB C');
    expect(message.words).toHaveLength(2);
    expect(message.words[0]?.letters.map((l) => l.char)).toEqual(['A', 'B']);
    expect(message.words[1]?.letters.map((l) => l.char)).toEqual(['C']);
  });

  it('exposes marks as symbols, not a string', () => {
    expect(encode('A').words[0]?.letters[0]?.symbols).toEqual(['.', '-']);
  });

  it('produces no words at all for empty input', () => {
    expect(encode('   ').words).toEqual([]);
  });
});

describe('decode', () => {
  it('reads the canonical form', () => {
    expect(decode('.... . .-.. .-.. --- / .-- --- .-. .-.. -..')).toBe('HELLO WORLD');
  });

  it('accepts three or more spaces as a word break, as a human would tap it', () => {
    expect(decode('....   .')).toBe('H E');
  });

  it('tolerates ragged whitespace inside a word', () => {
    expect(decode('  ...  ---  ...  ')).toBe('SOS');
  });

  it('draws the word boundary at exactly three spaces', () => {
    expect(decode('...  ---')).toBe('SO');
    expect(decode('...   ---')).toBe('S O');
  });

  it('marks unknown tokens rather than guessing', () => {
    expect(decode('... .......... ...')).toBe(`S${UNDECODABLE}S`);
  });

  it('does not use "?" for undecodable input, since "?" is itself encodable', () => {
    expect(UNDECODABLE).not.toBe('?');
    expect(decode('..--..')).toBe('?');
  });

  it('returns an empty string for empty input', () => {
    expect(decode('   ')).toBe('');
  });
});

describe('round trip', () => {
  it('holds for every supported character', () => {
    const all = SUPPORTED_CHARACTERS.join('');
    expect(decode(encodeToString(all))).toBe(normaliseForMorse(all));
  });

  it('states the invariant against the normalised input, not the raw input', () => {
    const text = 'Ação, você está?';
    expect(decode(encodeToString(text))).toBe(normaliseForMorse(text));
    expect(normaliseForMorse(text)).not.toBe(text.toUpperCase());
  });
});

describe('unsupportedCharacters', () => {
  it('finds nothing to complain about in encodable text', () => {
    expect(unsupportedCharacters('Hello world')).toEqual([]);
    expect(unsupportedCharacters('SOS 123 -.!?')).toEqual([]);
  });

  it('reports what the encoder would throw away', () => {
    expect(unsupportedCharacters('Hi 日本')).toEqual(['日', '本']);
    expect(unsupportedCharacters('a#b')).toEqual(['#']);
  });

  it('reports each character once, in the order it first appears', () => {
    expect(unsupportedCharacters('#a~b#c~')).toEqual(['#', '~']);
  });

  // Folding is a substitution the recipient can read, not a loss.
  it('says nothing about diacritics that fold onto a letter', () => {
    expect(unsupportedCharacters('Ação')).toEqual([]);
    expect(unsupportedCharacters('àéîõü')).toEqual([]);
  });

  it('says nothing about the three accents with codes of their own', () => {
    expect(unsupportedCharacters('ÇÉÑ')).toEqual([]);
  });

  // ß uppercases to SS, so nothing is lost — reporting it would be a lie.
  it('follows the encoder through case folding', () => {
    expect(unsupportedCharacters('straße')).toEqual([]);
  });

  it('never complains about whitespace, which is collapsed rather than lost', () => {
    expect(unsupportedCharacters('  \t\n  ')).toEqual([]);
    expect(unsupportedCharacters('a\tb')).toEqual([]);
  });

  it('reports a character as it was typed, not as it was folded', () => {
    // Uppercased, because that is the form the encoder works in.
    expect(unsupportedCharacters('日')).toEqual(['日']);
  });

  it('handles characters outside the basic plane as single characters', () => {
    expect(unsupportedCharacters('😀x😀')).toEqual(['😀']);
  });

  // A combining mark with nothing to combine with folds away to nothing at all.
  // The encoder drops it, so it is a loss and must be reported like any other.
  it('reports a stray combining mark, which folds away to nothing', () => {
    expect(unsupportedCharacters('\u0301')).toEqual(['\u0301']);
    // Attached to a letter it is not a loss — the letter survives.
    expect(unsupportedCharacters('e\u0301')).toEqual([]);
  });

  it('finds nothing in an empty string', () => {
    expect(unsupportedCharacters('')).toEqual([]);
  });
});

describe('letterAt', () => {
  it('counts straight through words, not per word', () => {
    const message = encode('AB CD');
    expect(letterAt(message, 0)?.char).toBe('A');
    expect(letterAt(message, 1)?.char).toBe('B');
    expect(letterAt(message, 2)?.char).toBe('C');
    expect(letterAt(message, 3)?.char).toBe('D');
  });

  it('carries the marks along with the character', () => {
    expect(letterAt(encode('SOS'), 1)?.symbols).toEqual(['-', '-', '-']);
  });

  // A selection can outlive the text it was made in.
  it('finds nothing past the end of the message', () => {
    expect(letterAt(encode('AB'), 2)).toBeNull();
    expect(letterAt(encode(''), 0)).toBeNull();
  });

  it('finds nothing for an index that names no letter', () => {
    const message = encode('AB');
    expect(letterAt(message, -1)).toBeNull();
    expect(letterAt(message, 1.5)).toBeNull();
    expect(letterAt(message, Number.NaN)).toBeNull();
  });
});

describe('messageOfLetter', () => {
  it('wraps a letter as a message of exactly that letter', () => {
    const letter = letterAt(encode('SOS'), 1);
    expect(letter).not.toBeNull();
    expect(messageOfLetter(letter!)).toEqual({ words: [{ letters: [letter] }] });
  });

  // The point of it: one letter encodes and renders like any other message.
  it('produces the same message as encoding that letter alone', () => {
    const letter = letterAt(encode('HI'), 0);
    expect(messageOfLetter(letter!)).toEqual(encode('H'));
  });
});
