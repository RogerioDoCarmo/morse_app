// ⚠️ `docs/` IS A PUBLIC WEBSITE, NOT A DOCUMENTATION FOLDER.
//
// GitHub Pages is configured as `main` branch, `/docs` folder, which means
// EVERYTHING in there is served to anyone who asks. That is easy to forget,
// because the name says "docs" and a repository's docs are normally internal.
//
// It had already happened: ten engineering notes — the worklist, the store
// strategy with its tester counts, the machine setup, the service-account
// how-to — were being served at
// `rogeriodocarmo.github.io/morse_app/NEXT-STEPS.md` and friends, as raw
// markdown, beside the app's own privacy policy. Nothing secret was in them and
// the repository is public anyway, so nothing leaked; the point is that nobody
// chose it. They moved to `notes/` on 14 October 2026.
//
// ⚠️ A comment saying "don't put notes here" would not have survived. This is
// the same reasoning as the dispatch-only guard in `ci-workflows.test.ts`: the
// rule has to fail a build, because the next person adding a file to `docs/`
// will be thinking about the file, not about Pages.
import * as fs from 'fs';
import * as path from 'path';

const DOCS = path.join(__dirname, 'docs');

/**
 * What a static site legitimately serves. ⚠️ Deliberately a TYPE check rather
 * than a fixed list of filenames: a terms page or a stylesheet is a reasonable
 * thing to add later and should not need this test edited, while a `.md` note
 * or a subdirectory of them is the mistake being prevented.
 */
const PUBLISHABLE = /\.(html|css|js|png|jpg|jpeg|svg|ico|webmanifest|txt|xml)$/u;

describe('docs/ is the published website and nothing else', () => {
  const entries = fs.readdirSync(DOCS, { withFileTypes: true });

  it('contains no notes and no directories', () => {
    // ⚠️ Directories count: Pages serves their contents too, which is how
    // `docs/status/` published a status report and a PDF nobody had thought
    // about since September.
    const offenders = entries
      .filter((e) => e.isDirectory() || !PUBLISHABLE.test(e.name))
      .map((e) => e.name);
    expect(offenders).toEqual([]);
  });

  /**
   * ⚠️ Three pages are load-bearing and their absence is invisible until
   * someone outside notices. The privacy policy is linked from BOTH store
   * listings and is required for the camera and microphone permissions;
   * `index.html` is the only thing stopping the root URL from returning 404,
   * which it did until 14 October 2026 — while `FOUNDATION.md` had said it
   * would for weeks.
   */
  it.each(['index.html', 'privacy-policy.html', 'support.html'])(
    '%s is present',
    (file) => {
      expect(fs.existsSync(path.join(DOCS, file))).toBe(true);
    },
  );

  /**
   * Without this the test above passes just as well on a repository where the
   * notes were deleted rather than moved — which is the one outcome nobody
   * wants and the one a green suite would happily certify.
   */
  it('finds the notes where they were moved to, rather than nowhere', () => {
    const notes = fs
      .readdirSync(path.join(__dirname, 'notes'))
      .filter((f) => f.endsWith('.md'));
    expect(notes).toContain('NEXT-STEPS.md');
    expect(notes.length).toBeGreaterThanOrEqual(10);
  });
});
