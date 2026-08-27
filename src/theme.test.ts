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
