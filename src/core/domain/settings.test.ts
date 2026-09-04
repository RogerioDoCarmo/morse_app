import {
  DEFAULT_SETTINGS,
  PLAYBACK_WPM_CHOICES,
  SETTINGS_KEYS,
  parseFlag,
  parsePlaybackWpm,
  parseSettings,
  parseTapUnitMs,
  serialiseFlag,
} from './settings';

describe('the shipped defaults', () => {
  // Literal values, not references to the constants they came from: a test
  // that reads `DEFAULT_UNIT_MS` passes whatever that becomes.
  it('starts at a 180 ms cut-off and 10 WPM', () => {
    expect(DEFAULT_SETTINGS.tapUnitMs).toBe(180);
    expect(DEFAULT_SETTINGS.playbackWpm).toBe(10);
  });

  it('starts with both switches on', () => {
    expect(DEFAULT_SETTINGS.speakDecoded).toBe(true);
    expect(DEFAULT_SETTINGS.crashReports).toBe(true);
  });

  it('offers three speeds', () => {
    expect(PLAYBACK_WPM_CHOICES).toStrictEqual([5, 10, 15]);
  });

  it('namespaces every key so nothing collides with firstRun', () => {
    expect(Object.values(SETTINGS_KEYS)).toStrictEqual([
      'settings.tapUnitMs',
      'settings.playbackWpm',
      'settings.speakDecoded',
      'settings.crashReports',
    ]);
  });
});

describe('parseTapUnitMs', () => {
  it('keeps a stored value that is in range', () => {
    expect(parseTapUnitMs('250')).toBe(250);
  });

  it('holds a value from a wider old build inside the range', () => {
    expect(parseTapUnitMs('40')).toBe(80);
    expect(parseTapUnitMs('900')).toBe(400);
  });

  it.each([
    ['nothing stored', null],
    ['an empty string', ''],
    ['junk', 'fast'],
  ])('falls back to 180 on %s', (_label, raw) => {
    expect(parseTapUnitMs(raw)).toBe(180);
  });
});

describe('parsePlaybackWpm', () => {
  it.each([
    ['5', 5],
    ['10', 10],
    ['15', 15],
  ])('accepts %s, which the picker can show', (raw, expected) => {
    expect(parsePlaybackWpm(raw)).toBe(expected);
  });

  // A speed the picker cannot show would be a setting the user can leave and
  // never get back to.
  it.each([
    ['a speed no longer offered', '20'],
    ['a speed between two offered ones', '12'],
    ['nothing stored', null],
    ['junk', 'quick'],
  ])('falls back to 10 on %s', (_label, raw) => {
    expect(parsePlaybackWpm(raw)).toBe(10);
  });
});

describe('parseFlag', () => {
  it('reads back exactly what serialiseFlag wrote', () => {
    expect(parseFlag(serialiseFlag(true), false)).toBe(true);
    expect(parseFlag(serialiseFlag(false), true)).toBe(false);
  });

  it('writes the two strings it claims to', () => {
    expect(serialiseFlag(true)).toBe('true');
    expect(serialiseFlag(false)).toBe('false');
  });

  // The fallback is the caller's default, so an untouched setting keeps
  // whatever the app ships with rather than a hardcoded true.
  it.each([
    ['nothing stored', null],
    ['an empty string', ''],
    ['a truthy-looking string', '1'],
    ['a word', 'yes'],
    ['the wrong case', 'TRUE'],
  ])('returns the given fallback on %s', (_label, raw) => {
    expect(parseFlag(raw, true)).toBe(true);
    expect(parseFlag(raw, false)).toBe(false);
  });
});

describe('parseSettings', () => {
  it('rebuilds every field from storage', () => {
    expect(
      parseSettings({
        'settings.tapUnitMs': '220',
        'settings.playbackWpm': '15',
        'settings.speakDecoded': 'false',
        'settings.crashReports': 'false',
      }),
    ).toStrictEqual({
      tapUnitMs: 220,
      playbackWpm: 15,
      speakDecoded: false,
      crashReports: false,
    });
  });

  it('returns the defaults for a device that has stored nothing', () => {
    expect(parseSettings({})).toStrictEqual({
      tapUnitMs: 180,
      playbackWpm: 10,
      speakDecoded: true,
      crashReports: true,
    });
  });

  // One bad field is why these are separate keys rather than one JSON blob.
  it('keeps the good fields when one is unreadable', () => {
    expect(
      parseSettings({
        'settings.tapUnitMs': 'corrupted',
        'settings.playbackWpm': '15',
      }),
    ).toStrictEqual({
      tapUnitMs: 180,
      playbackWpm: 15,
      speakDecoded: true,
      crashReports: true,
    });
  });
});
