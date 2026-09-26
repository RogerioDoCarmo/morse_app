import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { theme } from './theme';

/**
 * Guards the tokens the UI actually consumes.
 *
 * `StyleSheet.create` runs at module scope, so a token that goes missing — a bad
 * merge, a refactor, a trimmed export — does not fail a type check inside a
 * spread, it crashes the app at import time with "cannot read property of
 * undefined". This walks the real source and proves every `theme.*` path a
 * component references actually resolves.
 */

const SRC = join(__dirname);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.tsx?$/u.test(entry) || /\.test\.tsx?$/u.test(entry)) return [];
    return [full];
  });
}

const resolve = (path: readonly string[]): unknown =>
  path.reduce<unknown>(
    (node, key) =>
      node !== null && typeof node === 'object'
        ? (node as Record<string, unknown>)[key]
        : undefined,
    theme,
  );

describe('theme tokens', () => {
  const files = sourceFiles(SRC);

  it('finds source to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('resolves every theme path the source references', () => {
    const missing: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(
        /\btheme\.([A-Za-z]\w*)(?:\.([A-Za-z]\w*))?/gu,
      )) {
        const path = [match[1], match[2]].filter((p): p is string => Boolean(p));
        if (resolve(path) === undefined) {
          missing.push(`${file.replace(SRC, 'src')}: theme.${path.join('.')}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('keeps the 44pt touch target floor the design settled on', () => {
    expect(theme.hitTarget).toBeGreaterThanOrEqual(44);
  });

  it('gives every shadow a usable boxShadow array', () => {
    for (const [name, layers] of Object.entries(theme.shadow)) {
      expect(Array.isArray(layers)).toBe(true);
      expect(layers.length).toBeGreaterThan(0);
      for (const layer of layers) {
        expect(typeof layer.offsetY).toBe('number');
        expect(typeof layer.blurRadius).toBe('number');
        expect(layer.color).toMatch(/^rgba?\(/u);
      }
      expect(name).toMatch(/^\w+$/u);
    }
  });

  it('gives every colour a real hex value', () => {
    for (const value of Object.values(theme.color)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/u);
    }
  });
});

/**
 * ⚠️ THE FIELD'S OWN TEXT. Reported from a device as too big at 26, and the
 * numbers are asserted literally for the reason the rest of this file is:
 * reading the token back and comparing it to itself passes at any value.
 *
 * ⚠️ Three screens render this one token — the Translator's field, the guide's
 * mocked sample, and the Speak transcript — so a change here is a change to
 * all three, and to the store screenshots that show the first two.
 */
describe('the input type scale', () => {
  it('is 22 point, the size a device asked for', () => {
    expect(theme.type.input.fontSize).toBe(22);
  });

  /** The ratios it had at 26: -0.02em of tracking, and 1.27x leading. */
  it('keeps its proportions at the smaller size', () => {
    expect(theme.type.input.letterSpacing).toBe(-0.44);
    expect(theme.type.input.lineHeight).toBe(28);
  });
});
