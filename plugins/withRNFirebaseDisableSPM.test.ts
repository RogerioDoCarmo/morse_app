// The plugin is CommonJS, loaded by Expo the same way.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('./withRNFirebaseDisableSPM.js') as {
  setDisableSPM: (contents: string) => string;
  FLAG: string;
  ANCHOR: string;
};

const { setDisableSPM, FLAG, ANCHOR } = plugin;

const podfile = (body: string): string =>
  ["require 'json'", '', ANCHOR, '', body].join('\n');

describe('withRNFirebaseDisableSPM', () => {
  it('sets the flag before the target block', () => {
    const result = setDisableSPM(podfile("target 'Morse' do"));

    expect(result).toContain('$RNFirebaseDisableSPM = true');
    expect(result.indexOf(FLAG)).toBeLessThan(result.indexOf("target 'Morse' do"));
  });

  // Prebuild runs the mod on every invocation; a second pass must not stack.
  it('is idempotent', () => {
    const once = setDisableSPM(podfile("target 'Morse' do"));

    expect(setDisableSPM(once)).toBe(once);
  });

  it('keeps the rest of the Podfile intact', () => {
    const result = setDisableSPM(podfile("target 'Morse' do"));

    expect(result).toContain("require 'json'");
    expect(result).toContain(ANCHOR);
  });

  // Silently doing nothing would resurrect the duplicate-symbol link failure
  // with no clue as to why.
  it('throws when Expo moves the anchor', () => {
    expect(() => setDisableSPM("target 'Morse' do\nend\n")).toThrow(ANCHOR);
  });
});
