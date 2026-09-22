// Both consoles reject listing copy that outgrows a field, at paste time, one
// field at a time, in a browser. These limits are cheap to check here and slow
// to discover there — and the copy exists in three languages, so the one that
// overflows is rarely the one that was edited.
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const DIRECTORY = path.join(__dirname, 'store-assets', 'listing');

/** The languages the app ships in, and therefore the listing does. */
const LOCALES = ['en-US', 'pt-BR', 'es-419'] as const;

/**
 * Every field's limit, and which console imposes it.
 *
 * Three blocks are pasted into BOTH stores, so the tighter of the two limits
 * is the one that governs. `Release notes` is the one where they differ and
 * it matters: Play allows 500, Apple 4000. Writing to Apple's would produce
 * copy that cannot be pasted into Play.
 */
const LIMITS: Readonly<Record<string, { limit: number; from: string }>> = {
  'App name': { limit: 30, from: 'both' },
  'Short description': { limit: 80, from: 'Play' },
  Subtitle: { limit: 30, from: 'App Store' },
  Keywords: { limit: 100, from: 'App Store' },
  'Promotional text': { limit: 170, from: 'App Store' },
  'Full description': { limit: 4000, from: 'both' },
  'Release notes': { limit: 500, from: 'Play — Apple allows 4000' },
};

/**
 * The text of one `## Section` heading's fenced block.
 *
 * A hand-rolled scan rather than a Markdown dependency for four regexes —
 * every block in these files is a ```text fence directly under its heading,
 * and markdownlint already validates the documents as Markdown.
 */
function block(source: string, section: string): string | null {
  const match = new RegExp(
    `## ${section}\\n\\n(?:[^\`]*\\n\\n)?\`\`\`text\\n([\\s\\S]*?)\`\`\``,
    'u',
  ).exec(source);
  return match?.[1]?.trimEnd() ?? null;
}

const FILES = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    fs.readFileSync(path.join(DIRECTORY, `${locale}.md`), 'utf8'),
  ]),
) as Record<(typeof LOCALES)[number], string>;

describe('store listing copy', () => {
  it.each(LOCALES)('has a file for %s', (locale) => {
    expect(FILES[locale].length).toBeGreaterThan(0);
  });

  // Guards the scan: a heading renamed, or a fence that stopped being ```text,
  // would make every limit below vacuously true.
  it.each(LOCALES)('finds every field in %s', (locale) => {
    const missing = Object.keys(LIMITS).filter(
      (section) => block(FILES[locale], section) === null,
    );
    expect(missing).toStrictEqual([]);
  });

  it.each(
    LOCALES.flatMap((locale) =>
      Object.entries(LIMITS).map(
        ([section, { limit }]) => [locale, section, limit] as const,
      ),
    ),
  )('keeps %s "%s" inside %i characters', (locale, section, limit) => {
    const text = block(FILES[locale], section);
    expect(text).not.toBeNull();
    expect([...(text as string)].length).toBeLessThanOrEqual(limit);
  });

  // The app name is an identity, not copy. Three listings calling the app
  // three things is the kind of thing nobody notices until a user does.
  it('calls the app the same thing in every language', () => {
    const names = LOCALES.map((locale) => block(FILES[locale], 'App name'));
    expect(new Set(names).size).toBe(1);
  });

  /** Lowercased words, punctuation stripped — how a store indexes a phrase. */
  function words(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^\p{Letter}\p{Number}]+/u)
      .filter((word) => word.length > 0);
  }

  const keywordsOf = (locale: (typeof LOCALES)[number]): string[] =>
    (block(FILES[locale], 'Keywords') as string).split(',');

  // ⚠️ Apple counts a space after a comma as a character. On a 100-character
  // field that is a whole keyword thrown away, and nothing is gained by it.
  it.each(LOCALES)('separates %s keywords with commas and nothing else', (locale) => {
    expect(block(FILES[locale], 'Keywords')).not.toMatch(/\s/u);
  });

  it.each(LOCALES)('spends no character twice in %s keywords', (locale) => {
    const terms = keywordsOf(locale);
    expect([...new Set(terms)]).toStrictEqual(terms);
  });

  // Apple indexes the name, the subtitle AND the keywords as one pool. A word
  // that appears in two of them is paid for twice and found once.
  it.each(LOCALES)('does not repeat the %s subtitle in its keywords', (locale) => {
    const indexedAlready = new Set([
      ...words(block(FILES[locale], 'App name') as string),
      ...words(block(FILES[locale], 'Subtitle') as string),
    ]);
    // Tokenised rather than compared raw, so this holds even when the
    // whitespace test above is the one that is failing.
    const wasted = keywordsOf(locale).filter((term) =>
      words(term).some((word) => indexedAlready.has(word)),
    );
    expect(wasted).toStrictEqual([]);
  });

  // Every keyword is one term. A multi-word keyword is a phrase Apple would
  // have assembled by itself out of the single words around it.
  it.each(LOCALES)('keeps every %s keyword a single term', (locale) => {
    const terms = keywordsOf(locale);
    expect(terms.filter((term) => words(term).length !== 1)).toStrictEqual([]);
  });

  /**
   * ⚠️ The listing must not promise what the app does not do.
   *
   * "No analytics" is true today and becomes false the moment Firebase
   * Analytics ships — which is planned. This is the tripwire for that: add
   * Analytics without rewriting the listing and this test says so, in the
   * language whose file was forgotten.
   */
  it.each([
    ['en-US', /no analytics/iu],
    ['pt-BR', /sem analytics/iu],
    ['es-419', /sin analytics/iu],
  ] as const)(
    'still claims no analytics in %s, which the app must keep true',
    (locale, claim) => {
      expect(block(FILES[locale], 'Full description')).toMatch(claim);
    },
  );
});

/**
 * ⚠️ THE FEATURE GRAPHIC CARRIES COPY, SO IT HAS A LANGUAGE.
 *
 * It shipped English-only until 22 September and nothing objected — the listing
 * copy was translated three ways, the screenshots were captured three ways, and
 * the one image with a sentence on it stayed in English. An English-only asset
 * looks finished; nothing about it says the other locales are missing, which is
 * the same failure shape as the blank tablet illustration.
 *
 * ⚠️ `play-feature-graphic.png` IS the en-US one and is deliberately NOT
 * suffixed: `tools/compose-video.sh` opens it by that exact path as the video's
 * card, and `video-assets.test.ts` pins the path. Renaming it would break the
 * promo build for the sake of symmetry.
 */
describe('the feature graphic exists in every language', () => {
  const GRAPHICS = path.join(DIRECTORY, 'graphics');

  /** The file for a locale — en-US is the unsuffixed default, see above. */
  const graphic = (locale: string): string =>
    path.join(
      GRAPHICS,
      locale === 'en-US'
        ? 'play-feature-graphic.png'
        : `play-feature-graphic.${locale}.png`,
    );

  /** Width and height from a PNG's IHDR, without decoding the image. */
  const size = (file: string): { width: number; height: number } => {
    const head = fs.readFileSync(file).subarray(16, 24);
    return { width: head.readUInt32BE(0), height: head.readUInt32BE(4) };
  };

  it.each(LOCALES)('has a feature graphic for %s', (locale) => {
    expect(fs.existsSync(graphic(locale))).toBe(true);
  });

  // Play rejects anything else outright, and it rejects at upload time.
  it.each(LOCALES)('sizes the %s feature graphic at exactly 1024x500', (locale) => {
    expect(size(graphic(locale))).toEqual({ width: 1024, height: 500 });
  });

  /**
   * Three identical files would pass every check above while meaning the
   * translations were never made — which is precisely what "it exists" checks
   * missed the first time.
   */
  it('gives each language its own artwork rather than three copies of one', () => {
    const digests = LOCALES.map((locale) =>
      fs.readFileSync(graphic(locale)).toString('base64'),
    );
    expect(new Set(digests).size).toBe(LOCALES.length);
  });
});

/**
 * ⚠️ THE VERSION FOLDER IS GENERATED, AND THIS IS WHAT KEEPS IT HONEST.
 *
 * `store-assets/<version>/listing/` holds paste-ready copy split by console,
 * because the two take different fields — App Store Connect has Subtitle,
 * Keywords and Promotional Text and no Short description; Play is the reverse.
 * Reading past inapplicable fields while pasting into a browser is how the
 * wrong text ends up in the wrong box.
 *
 * But a second copy of the copy is exactly what `store-assets/listing/*.md`
 * warns against in its own header: "copy kept twice is copy that disagrees
 * with itself eventually". So it is DERIVED, and this test runs the renderer
 * in `--check` mode. Edit the source without re-rendering and the build fails,
 * rather than the console quietly receiving last week's wording.
 */
describe('the per-version listing copy is in step with its source', () => {
  it('matches what the renderer would write', () => {
    const result = spawnSync(
      'python3',
      [path.join(__dirname, 'tools', 'render-version-listing.py'), '--check'],
      {
        encoding: 'utf8',
      },
    );

    // ⚠️ A missing interpreter must fail, not skip. A check that silently does
    // not run is the shape of every guard that has let something through here.
    expect(result.error).toBeUndefined();
    expect(`${result.stdout}${result.stderr}`.trim()).not.toContain('out of date');
    expect(result.status).toBe(0);
  });
});
