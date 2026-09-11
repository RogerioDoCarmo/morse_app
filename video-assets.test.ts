// The video flows are recorded, not asserted — nothing in CI fails when one of
// them drifts, because the only symptom is footage that looks wrong, seen
// after it has been published. These are the checks that would otherwise be
// somebody noticing.
import * as fs from 'fs';
import * as path from 'path';

const VIDEO_DIR = path.join(__dirname, '.maestro', 'video');
const COMPOSE = fs.readFileSync(
  path.join(__dirname, 'tools', 'compose-video.sh'),
  'utf8',
);
const WORKFLOW = fs.readFileSync(
  path.join(__dirname, '.github', 'workflows', 'videos.yml'),
  'utf8',
);
const RECORDER = fs.readFileSync(
  path.join(__dirname, 'tools', 'record-video-clips.sh'),
  'utf8',
);

/** The four tabs, and the screen each one lands on. */
const TABS: Readonly<Record<string, string>> = {
  'tab-translate': 'translator-screen',
  'tab-speak': 'speech-screen',
  'tab-tap': 'tap-screen',
  'tab-learn': 'learn-screen',
};

const read = (name: string): string =>
  fs.readFileSync(path.join(VIDEO_DIR, `${name}.yaml`), 'utf8');

/**
 * The first capture group, or a failure naming the pattern that missed.
 *
 * `exec` returns `RegExpExecArray | null` and, under
 * `noUncheckedIndexedAccess`, group 1 is `string | undefined` even after a
 * null check — so every call site would otherwise carry two assertions that
 * say nothing about what actually went wrong.
 */
function capture(pattern: RegExp, source: string, what: string): string {
  const group = pattern.exec(source)?.[1];
  if (group === undefined) throw new Error(`No ${what} matched ${String(pattern)}`);
  return group;
}

/** A flow with its commentary and blank lines removed — the commands alone. */
function commands(source: string): string {
  return source
    .split('\n')
    .filter((line) => !/^\s*#/u.test(line) && line.trim() !== '')
    .join('\n')
    .trim();
}

describe('video flows', () => {
  it.each(Object.keys(TABS))('has a flow for %s', (tab) => {
    expect(fs.existsSync(path.join(VIDEO_DIR, `${tab}.yaml`))).toBe(true);
  });

  /**
   * ⚠️ The four tab clips are recorded separately and played SIMULTANEOUSLY,
   * side by side in one frame. Nothing synchronises them. The only thing
   * keeping the four phones in step is that each does identical work before
   * its own footage starts to matter, and `compose-video.sh` trims one fixed
   * lead-in off all four.
   *
   * Written out in full rather than compared against each other: three flows
   * that drifted together would pass a comparison, and this is the shape the
   * lead-in was measured against.
   */
  it.each(Object.entries(TABS))('gives %s the shared lead-in, exactly', (tab, screen) => {
    const preamble = `appId: com.rogeriodocarmo.morse
---
- retry:
    maxRetries: 2
    commands:
      - launchApp:
          clearState: true
      - runFlow: ../dismiss-first-run.yaml
- tapOn:
    id: '${tab}'
- assertVisible:
    id: '${screen}'
- waitForAnimationToEnd:
    timeout: 1500`;
    expect(commands(read(tab)).startsWith(preamble)).toBe(true);
  });

  /**
   * ⚠️ The Light channel drives the torch, and the torch is behind the CAMERA
   * permission on Android. Switching it on in a recorded flow puts a system
   * permission dialog in the middle of a published video — and in a store
   * asset that is a rejection waiting to happen.
   */
  it.each(['tour', ...Object.keys(TABS)])('never switches the torch on in %s', (flow) => {
    expect(read(flow)).not.toContain('channel-light');
  });

  // The promo is the one asset that has to show the whole app; a tour that
  // quietly stopped visiting a tab would still record perfectly well.
  it.each(['tab-speak', 'tab-tap', 'tab-learn'])('takes the tour through %s', (tab) => {
    expect(read('tour')).toContain(`id: '${tab}'`);
  });

  // `waitToSettleTimeoutMs: 0` on the play button. A message plays
  // continuously, so the screen never settles and Maestro waits out its own
  // timeout on every tap that starts one.
  it.each(['tour', 'tab-translate'])(
    'does not wait for a playing screen to settle in %s',
    (flow) => {
      const source = read(flow);
      const signalTaps = source.match(
        /- tapOn:\n\s+id: 'signal-button'\n(\s+waitToSettleTimeoutMs: 0\n)?/gu,
      );
      expect(signalTaps).not.toBeNull();
      expect((signalTaps as string[])[0]).toContain('waitToSettleTimeoutMs: 0');
    },
  );
});

describe('compose-video.sh', () => {
  /** A `NAME=${NAME:-value}` default from the script. */
  function defaultOf(name: string): number {
    return Number(
      capture(new RegExp(`^${name}=\\$\\{${name}:-(\\d+)\\}`, 'mu'), COMPOSE, name),
    );
  }

  it('composes the same four tabs the flows provide', () => {
    const tabs = capture(/^TABS=\(([^)]*)\)/mu, COMPOSE, 'TABS array');
    expect(tabs.trim().split(/\s+/u)).toStrictEqual(Object.keys(TABS));
  });

  // ⚠️ Four cells side by side have to FIT. Overflowing 1920 does not fail the
  // ffmpeg graph — `pad` refuses a target smaller than its input, so the job
  // dies in compositing after forty minutes of recording.
  it('fits four cells inside a 1920x1080 frame', () => {
    expect(defaultOf('CELL_W') * 4).toBeLessThanOrEqual(1920);
    expect(defaultOf('CELL_H')).toBeLessThanOrEqual(1080);
  });

  it('leaves the promo phone inside the frame too', () => {
    expect(defaultOf('PHONE_H')).toBeLessThanOrEqual(1080);
  });

  // H.264 refuses odd dimensions, and the failure lands at encode time rather
  // than at scale time — minutes later, naming neither.
  it.each([
    ['CELL_W', 428],
    ['CELL_H', 950],
    ['PHONE_H', 1000],
  ])('keeps %s even', (name, expected) => {
    expect(defaultOf(name)).toBe(expected);
    expect(defaultOf(name) % 2).toBe(0);
  });

  // The clips have to outlast what the grid trims off the front and then
  // plays, or hstack ends the grid early and the cells stop together.
  it('records for longer than it trims and plays', () => {
    const needed = defaultOf('LEAD_IN') + defaultOf('GRID_SECONDS');
    const holds = [...read('tab-speak').matchAll(/timeout: (\d+)/gu)].map((m) =>
      Number(m[1]),
    );
    expect(holds.reduce((sum, ms) => sum + ms, 0) / 1000).toBeGreaterThanOrEqual(
      needed - 6,
    );
  });
});

describe('videos.yml', () => {
  // A flow added to the directory and not to the loop is a flow that never
  // gets recorded, and the only evidence is a missing cell in the output.
  it('records every flow the directory holds', () => {
    const onDisk = fs
      .readdirSync(VIDEO_DIR)
      .filter((name) => name.endsWith('.yaml'))
      .map((name) => name.replace(/\.yaml$/u, ''))
      .sort();
    const order = capture(/^ORDER=\(([^)]*)\)/mu, RECORDER, 'ORDER array');
    expect(order.trim().split(/\s+/u).sort()).toStrictEqual(onDisk);
  });

  // The promo is the clip a stranger sees the opening of, so it must not be
  // the flow that wears whatever driver warm-up is left over.
  it('records the tour last', () => {
    const order = capture(/^ORDER=\(([^)]*)\)/mu, RECORDER, 'ORDER array')
      .trim()
      .split(/\s+/u);
    expect(order[order.length - 1]).toBe('tour');
  });

  /**
   * ⚠️ `reactivecircus/android-emulator-runner` does NOT run its `script:` as
   * a script. It splits the block on newlines and runs each line through its
   * own `sh -c`, so anything spanning more than one line is torn apart.
   *
   * The first run of this workflow recorded nothing at all because a shell
   * function was written there directly: forty minutes of build and emulator
   * time to find out, and the error named the line AFTER the one that opened
   * the brace. This is that mistake, made unrepeatable.
   */
  it('keeps every line of the emulator script a standalone command', () => {
    const block = capture(/\n {10}script: \|\n([\s\S]*?)\n\n/u, WORKFLOW, 'script block');
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'));

    expect(lines.length).toBeGreaterThan(0);
    // A continuation, an opened block, or a compound statement — each of which
    // needs the NEXT line to make sense, which it will never get.
    expect(
      lines.filter((line) => /(\\|\{|\bdo\b|\bthen\b|\|)$/u.test(line)),
    ).toStrictEqual([]);
  });

  /**
   * ⚠️ Every other device job in this repository disables animations, because
   * they make flows flaky. Here they ARE the subject: an app recorded with its
   * transitions off looks broken rather than fast.
   */
  it('leaves animations on, unlike every other device job', () => {
    expect(WORKFLOW).toContain('disable-animations: false');
  });

  // The 320x640 default is what the first full set of Android store
  // screenshots was captured at.
  it.each([
    ['.github/workflows/videos.yml', WORKFLOW],
    [
      '.github/workflows/screenshots.yml',
      fs.readFileSync(
        path.join(__dirname, '.github', 'workflows', 'screenshots.yml'),
        'utf8',
      ),
    ],
  ])('asks %s for a real phone profile', (_file, source) => {
    expect(source).toContain('profile: pixel_6');
  });
});
