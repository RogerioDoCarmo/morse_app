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
