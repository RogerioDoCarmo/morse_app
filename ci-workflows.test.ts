// Two settings that exist because of specific failures, and which look like
// arbitrary numbers to anyone tidying up later. Both cost a real afternoon on
// 17 September; neither leaves a trace in the app, so nothing else would notice
// them being changed back.
import * as fs from 'fs';
import * as path from 'path';

const workflow = (name: string): string =>
  fs.readFileSync(path.join(__dirname, '.github', 'workflows', name), 'utf8');

const E2E = workflow('e2e.yml');
const CI = workflow('ci.yml');

/** The job block for `name:`, up to the next top-level job key. */
const job = (source: string, id: string): string => {
  const start = source.indexOf(`\n  ${id}:\n`);
  expect(start).toBeGreaterThan(-1);
  const rest = source.slice(start + 1);
  const next = rest.search(/\n {2}\w[\w-]*:\n/u);
  return next === -1 ? rest : rest.slice(0, next);
};

describe('the iOS E2E cap clears the runner it runs on', () => {
  /**
   * ⚠️ 50 BEGAN FAILING GOOD RUNS. On #201 the job was killed at 50m34s with
   * its flows still passing, while the identical commit passed on the push run
   * at 41m11s and the retry passed with ~3 minutes spare. A cap sitting inside
   * that spread turns a green suite into a coin toss.
   */
  it('gives iOS at least 60 minutes', () => {
    const found = /timeout-minutes:\s*(\d+)/u.exec(job(E2E, 'ios'));

    expect(found).not.toBeNull();
    expect(Number((found as RegExpExecArray)[1])).toBeGreaterThanOrEqual(60);
  });

  // Android is a different machine with a different cost and has never come
  // close, so it is deliberately NOT raised alongside iOS — a cap that is
  // generous everywhere stops being a backstop anywhere.
  it('leaves the Android cap where it was', () => {
    const found = /timeout-minutes:\s*(\d+)/u.exec(job(E2E, 'android'));

    expect(found).not.toBeNull();
    expect(Number((found as RegExpExecArray)[1])).toBe(50);
  });

  it('keeps a backstop rather than removing the cap', () => {
    // ⚠️ Not unlimited. `./gradlew assembleRelease` once sat for over three
    // hours without reaching a single flow; the cap is what ends that.
    const found = /timeout-minutes:\s*(\d+)/u.exec(job(E2E, 'ios'));

    expect(Number((found as RegExpExecArray)[1])).toBeLessThanOrEqual(90);
  });
});

describe('a scanner outage does not fail the test suite', () => {
  /**
   * ⚠️ SonarCloud returned `Error 500` from its own servers four times in one
   * afternoon, failing a check called "Lint, typecheck and test" while every
   * one of those things passed. A red mark that means "someone else's service
   * is down" cannot be told apart from one that means "your tests fail".
   */
  it('marks the SonarCloud step non-blocking', () => {
    const start = CI.indexOf('- name: SonarCloud');
    expect(start).toBeGreaterThan(-1);

    expect(CI.slice(start, start + 300)).toContain('continue-on-error: true');
  });

  // ⚠️ Non-blocking is not disabled. The scan still runs and findings still
  // reach the SonarCloud project — dropping the step would lose the analysis,
  // which is not what this trades away.
  it('still runs the scan', () => {
    expect(CI).toContain('SonarSource/sonarqube-scan-action@v8');
  });

  // Nothing else in this job may quietly inherit the same forgiveness.
  it('forgives only that one step', () => {
    expect(CI.match(/continue-on-error/gu)).toHaveLength(1);
  });
});

/**
 * ⚠️ `secrets[expr]` HANDS THE WHOLE SECRETS CONTEXT TO A STEP.
 *
 * `secrets.FOO` is static: the expression compiler knows at parse time which
 * one secret is wanted, and materialises only that. `secrets[expr]` indexes
 * the context with a value that does not exist until the job is running, so
 * GitHub cannot predict the key and makes EVERY organization and repository
 * secret available to that step instead.
 *
 * `firebase-distribution.yml` did exactly this — it read the secret NAME out
 * of its matrix — to pass one Firebase app id to a THIRD-PARTY ACTION ON A
 * MOVING TAG. Nothing leaked; the point is blast radius. CodeQL alert #1,
 * "Excessive Secrets Exposure", open from 9 September.
 *
 * The fix is a static reference per branch. This test is here because the
 * dynamic form is the tidier-looking one, and the next person adding a third
 * platform will reach for it.
 */
describe('no workflow indexes the secrets context dynamically', () => {
  const WORKFLOWS = fs
    .readdirSync(path.join(__dirname, '.github', 'workflows'))
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

  /**
   * ⚠️ COMMENTS FIRST, and this file has already been bitten twice without it.
   * The note explaining the fix necessarily CONTAINS `secrets[matrix.…]`, so a
   * raw scan reports the fixed workflow as broken — the same way the tap-halo
   * guard failed on a comment saying "NOT tap-halo", and the Maestro gap test
   * measured the length of its own explanation.
   */
  const stripComments = (yaml: string): string =>
    yaml
      .split('\n')
      .map((line) => line.replace(/(^|\s)#.*$/u, '').trimEnd())
      .join('\n');

  it.each(WORKFLOWS)('%s uses static secret references', (name) => {
    const body = stripComments(workflow(name));
    expect(body).not.toMatch(/secrets\s*\[/u);
  });

  /**
   * The guard above is worthless if `stripComments` quietly empties the file,
   * so this pins that it removes the comment and keeps the code on the very
   * line the fix lives on.
   */
  it('strips the comment without eating the expression beside it', () => {
    const sample = "          appId: ${{ matrix.platform == 'android' }} # secrets[x]";
    expect(stripComments(sample)).toBe(
      "          appId: ${{ matrix.platform == 'android' }}",
    );
    expect(stripComments('  # secrets[matrix.app_id_secret]')).toBe('');
  });

  it('still sees the distribution step it is meant to be guarding', () => {
    expect(stripComments(workflow('firebase-distribution.yml'))).toContain(
      'secrets.FIREBASE_ANDROID_APP_ID',
    );
  });
});

/**
 * ⚠️ NOTHING AUTOMATIC MAY BUY A BUILD.
 *
 * `eas-build.yml` ran on `v*.*.*` tags, narrowed to that after five merges in
 * one evening cost seven iOS builds out of the fifteen a month the free plan
 * allows. `firebase-distribution.yml` ran on any push to develop touching
 * `package.json`. Both looked careful. Both spent credits nobody had asked for,
 * and the distribution one did worse: on 23 September it woke both platforms,
 * EAS incremented versionCode 15 → 16 and buildNumber 18 → 19, and THEN refused
 * for lack of credits. Two numbers spent on binaries that do not exist.
 *
 * ⚠️ The assertion is that `workflow_dispatch` is the ONLY trigger. Checking
 * that it is present passes on the version this guard exists to prevent, which
 * had `push` beside it.
 *
 * ⚠️ And the list of files is DERIVED, not written down. A guard naming three
 * workflows is silent about the fourth somebody adds.
 */
function paidWorkflows(): readonly string[] {
  const dir = path.join(__dirname, '.github', 'workflows');
  /**
   * Two billed things run from this repository, and they bill differently:
   *
   * - A cloud `eas build` costs a build credit. `--local` costs nothing, which
   *   is why the flag is checked rather than the command.
   * - Chromatic bills per SNAPSHOT — one per story per build — so it is
   *   expensive in proportion to the story count, which only ever grows.
   *
   * ⚠️ Chromatic contains no `eas build`. Matching on that alone — which is
   * what this did before `chromatic.yml` existed — would have exempted it
   * completely: a guard reporting success while the one newly added paid
   * workflow ran on every push.
   */
  const spendsMoney = (text: string): boolean => {
    const easLines = text.match(/eas build[^\n]*/gu) ?? [];
    const cloudEas = easLines.length > 0 && !easLines.every((l) => l.includes('--local'));
    return cloudEas || /chromaui\/action|chromatic --|pnpm chromatic/u.test(text);
  };
  return fs
    .readdirSync(dir)
    .filter((f) => /\.ya?ml$/u.test(f))
    .filter((f) => spendsMoney(workflow(f)));
}

describe('nothing automatic buys a paid build', () => {
  const paid = paidWorkflows();

  it('finds the workflows it is meant to be guarding', () => {
    // A derived list that came back empty would make every assertion below
    // pass by vacuum.
    expect(paid).toEqual(
      expect.arrayContaining([
        'eas-build.yml',
        'firebase-distribution.yml',
        'chromatic.yml',
      ]),
    );
  });

  /**
   * ⚠️ Its own stripper, not the one scoped to the block above. And it is
   * load-bearing: the comments added beside these triggers EXPLAIN the push and
   * tag rules they replaced, so a check against raw text would match its own
   * documentation and fail on a correct file.
   */
  const withoutComments = (text: string): string =>
    text
      .split('\n')
      .filter((line) => !/^\s*#/u.test(line))
      .join('\n');

  it.each(paid)('%s runs only when a human dispatches it', (name) => {
    const body = withoutComments(workflow(name));
    const on = body.slice(body.indexOf('\non:'), body.indexOf('\npermissions:'));

    expect(on).toContain('workflow_dispatch:');
    // The expensive half: no push, no tag, no pull request.
    expect(on).not.toMatch(/\n\s*push:/u);
    expect(on).not.toMatch(/\n\s*pull_request:/u);
    expect(on).not.toMatch(/tags:/u);
  });
});

/**
 * `release.yml` creates the GitHub Release from the annotated tag's message,
 * and refuses a tag whose name disagrees with `app.json` at that commit. That
 * guard is the only thing standing between a typo and a release claiming a
 * version the app does not ship.
 *
 * ⚠️ It must nevertheless accept semver BUILD METADATA. `v0.3.7+storybook` is
 * the same version with something extra in the repository and sorts EQUAL to
 * `0.3.7`; a `-suffix` is a PRE-release and sorts BEFORE it, which is a real
 * mistake and must still fail.
 *
 * ⚠️ This runs the workflow's own comparison, extracted from the file rather
 * than retyped here. A copy of the rule would pass while the workflow rejected
 * the tag, which is the failure mode worth avoiding.
 */
describe('a release tag may carry build metadata', () => {
  const script = workflow('release.yml');

  /** The two expansions the guard applies, in order, read out of the file. */
  const strip = (tag: string): string => {
    expect(script).toContain('TAG_VERSION="${TAG_VERSION#v}"');
    expect(script).toContain('TAG_VERSION="${TAG_VERSION%%+*}"');
    return tag.replace(/^v/u, '').replace(/\+.*$/u, '');
  };

  it.each([
    ['v0.3.7', '0.3.7'],
    ['v0.3.7+storybook', '0.3.7'],
    ['v0.3.7+build.12', '0.3.7'],
  ])('%s is compared as %s', (tag, expected) => {
    expect(strip(tag)).toBe(expected);
  });

  it.each([['v0.3.7-rc1'], ['v0.3.7-storybook']])(
    '%s is NOT reduced to 0.3.7, so a pre-release tag still fails the guard',
    (tag) => {
      expect(strip(tag)).not.toBe('0.3.7');
    },
  );

  it('still refuses a lightweight tag, where there are no notes to publish', () => {
    expect(script).toContain('is a lightweight tag');
    expect(script).toContain('exit 1');
  });
});

/**
 * `FOUNDATION.md` is the blueprint this project was built against, and its
 * CI table is read as the description of what runs. It drifted: for weeks it
 * described `chromatic.yml` as running on "PR + push" in a repository that had
 * no Chromatic at all, and `eas-build.yml` and `firebase-distribution.yml` as
 * push-triggered months after both became dispatch-only.
 *
 * ⚠️ A document claiming a capability the repository lacks costs more than one
 * admitting the gap — that table is what sent somebody to chromatic.com to
 * finish a setup that had never been started.
 *
 * So the doc is checked against the workflows rather than trusted.
 */
describe('FOUNDATION.md describes the triggers this repository actually has', () => {
  const foundation = fs.readFileSync(path.join(__dirname, 'FOUNDATION.md'), 'utf8');

  /** The row for a workflow in the CI table, if the table names it. */
  const row = (name: string): string | undefined =>
    foundation
      .split('\n')
      .find((line) => line.includes(`\`${name}\``) && line.includes('|'));

  it.each(paidWorkflows())('%s is listed as dispatch-only', (name) => {
    const line = row(name);
    expect(line).toBeDefined();
    // The table must say so, not merely avoid claiming otherwise.
    expect(line).toMatch(/workflow_dispatch/u);
    // And must not still carry the trigger it used to have.
    expect(line).not.toMatch(/\|\s*(PR \+ push|push to)/u);
  });
});
