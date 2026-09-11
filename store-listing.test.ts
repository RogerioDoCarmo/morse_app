// Play Console rejects listing copy that outgrows a field, at paste time, one
// field at a time, in a browser. These limits are cheap to check here and slow
// to discover there — and the copy exists in three languages, so the one that
// overflows is rarely the one that was edited.
import * as fs from 'fs';
import * as path from 'path';

const DIRECTORY = path.join(__dirname, 'docs', 'store-listing');

/** The languages the app ships in, and therefore the listing does. */
const LOCALES = ['en-US', 'pt-BR', 'es-419'] as const;

/** Play's own limits, per field. */
const LIMITS: Readonly<Record<string, number>> = {
  'App name': 30,
  'Short description': 80,
  'Full description': 4000,
  'Release notes': 500,
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
      Object.entries(LIMITS).map(([section, limit]) => [locale, section, limit] as const),
    ),
  )('keeps %s "%s" inside %i characters', (locale, section, limit) => {
    const text = block(FILES[locale], section);
    expect(text).not.toBeNull();
    expect((text as string).length).toBeLessThanOrEqual(limit);
  });

  // The app name is an identity, not copy. Three listings calling the app
  // three things is the kind of thing nobody notices until a user does.
  it('calls the app the same thing in every language', () => {
    const names = LOCALES.map((locale) => block(FILES[locale], 'App name'));
    expect(new Set(names).size).toBe(1);
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
