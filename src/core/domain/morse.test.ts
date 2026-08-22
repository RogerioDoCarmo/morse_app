import {
  SUPPORTED_CHARACTERS,
  UNDECODABLE,
  decode,
  encode,
  encodeToString,
  normaliseForMorse,
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
