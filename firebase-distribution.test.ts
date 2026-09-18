// Running out of EAS build credits is a BILLING state, not a broken build —
// and on 17 September this workflow reported it as the second kind. Both
// platforms went red on a release PR with "Build a preview binary — failure",
// which is exactly what a non-compiling app looks like. Nothing was wrong with
// the app; the month's free allowance was spent.
//
// A red check that means "the balance is zero" is worse than no check, because
// it cannot be told apart from the one that means "this code is broken". These
// tests hold the distinction, since the workflow itself only runs on a version
// bump and cannot be exercised on demand.
import * as fs from 'fs';
import * as path from 'path';

const WORKFLOW = fs.readFileSync(
  path.join(__dirname, '.github', 'workflows', 'firebase-distribution.yml'),
  'utf8',
);

/** The build step, from its `- name:` to the start of the next step. */
const buildStep = (): string => {
  const start = WORKFLOW.indexOf('- name: Build a preview binary');
  const next = WORKFLOW.indexOf('- name: Distribute to testers');
  expect(start).toBeGreaterThan(-1);
  expect(next).toBeGreaterThan(start);
  return WORKFLOW.slice(start, next);
};

/**
 * The exact text EAS printed on 17 September, kept verbatim. A paraphrase
 * would test the paraphrase.
 */
const CREDIT_ERROR = [
  "You've reached your included build credits this billing period.",
  'New builds are blocked until your billing period resets. Upgrade your plan to continue building.',
  'This account has used its builds from the Free plan this month, which will reset in 13 days (on Thu Oct 01 2026).',
].join('\n');

/** A genuine failure, which must still go red. */
const REAL_ERROR = [
  'error: Gradle build failed with unknown error. See logs for the "Run gradlew" phase.',
  'Build failed',
].join('\n');

/**
 * The workflow's own matcher, lifted out of the YAML rather than rewritten
 * here — a copy would drift and then agree with itself.
 */
function matcherFromWorkflow(): RegExp {
  const found = /grep -qiE '([^']+)'/u.exec(buildStep());
  expect(found).not.toBeNull();
  return new RegExp((found as RegExpExecArray)[1] as string, 'iu');
}

describe('a spent build allowance is not a build failure', () => {
  it('recognises the message EAS actually prints', () => {
    expect(matcherFromWorkflow().test(CREDIT_ERROR)).toBe(true);
  });

  // ⚠️ The whole point. Forgiving every non-zero exit would mean a broken
  // build distributing nothing and reporting success.
  it('does not recognise a real build failure', () => {
    expect(matcherFromWorkflow().test(REAL_ERROR)).toBe(false);
  });

  it('still fails the job on any other non-zero exit', () => {
    const step = buildStep();

    expect(step).toContain('This is a real build failure, not the credit balance.');
    expect(step).toMatch(/::error::/u);
    expect(step).toMatch(/exit 1/u);
  });

  // ⚠️ `set -e` would kill the step on eas's exit code before anything could
  // look at WHY it exited — which is how this reported a balance as a defect.
  it('lets the build exit non-zero so the reason can be read', () => {
    const step = buildStep();

    expect(step).toContain('set +e');
    expect(step).toContain('2> build.err');
    expect(step).not.toContain('set -euo pipefail');
  });

  it('says so out loud rather than passing quietly', () => {
    const step = buildStep();

    // A silently green check is the other way to make this unreadable.
    expect(step).toContain('GITHUB_STEP_SUMMARY');
    expect(step).toContain('::warning title=Distribution skipped::');
    expect(step).toContain('Distribution skipped — no EAS build credits');
  });

  it('tells the reader a re-run will not help', () => {
    expect(buildStep()).toContain('Re-running this will not help');
  });
});

describe('nothing is distributed when nothing was built', () => {
  // ⚠️ Without the guard the Firebase action runs against a file that was
  // never downloaded and fails — turning the red check we just removed into a
  // red check one step later.
  it('guards the Firebase upload on the build having happened', () => {
    const start = WORKFLOW.indexOf('- name: Distribute to testers');
    const step = WORKFLOW.slice(start, start + 400);

    expect(step).toContain("if: steps.build.outputs.skipped != 'true'");
  });

  it('gives the build step the id that guard refers to', () => {
    expect(buildStep()).toMatch(/^- name: Build a preview binary\n\s*id: build$/mu);
  });

  it('sets the output the guard reads', () => {
    expect(buildStep()).toContain('skipped=true');
    expect(buildStep()).toContain('GITHUB_OUTPUT');
  });
});
