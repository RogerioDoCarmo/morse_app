// The video flows are recorded, not asserted — nothing in CI fails when one of
// them drifts, because the only symptom is footage that looks wrong, seen
// after it has been published. These are the checks that would otherwise be
// somebody noticing.
import * as fs from 'fs';
import * as path from 'path';

import { encode } from '@/core/domain/morse';
import { toTimeline, unitMsForWpm } from '@/core/domain/timeline';

const VIDEO_DIR = path.join(__dirname, '.maestro', 'video');
const COMPOSE = fs.readFileSync(
  path.join(__dirname, 'tools', 'compose-video.sh'),
  'utf8',
);
const WORKFLOW = fs.readFileSync(
  path.join(__dirname, '.github', 'workflows', 'videos.yml'),
  'utf8',
);
const DETECTOR = fs.readFileSync(
  path.join(__dirname, 'tools', 'detect-playback-start.sh'),
  'utf8',
);
const RENDERER = fs.readFileSync(
  path.join(__dirname, 'tools', 'render-morse-audio.ts'),
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

/**
 * A shell script with its commentary removed — the code alone.
 *
 * These scripts explain their own traps at length, and a comment naming
 * `-sseof` must not read as a third use of it.
 */
function code(source: string): string {
  return source
    .split('\n')
    .filter((line) => !/^\s*#/u.test(line))
    .join('\n');
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
    id: '${screen}'`;
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

  /**
   * ⚠️ Trimmed from the END, never the front.
   *
   * Everything variable in a recording is at the front — emulator boot,
   * Maestro's driver, the app launch, and any retries a flow needed. What is
   * worth watching is at the end, where each flow holds still on purpose. A
   * fixed front trim of six seconds was wrong by fifty the first time flows
   * retried, and produced clips that never left the welcome carousel.
   */
  /**
   * ⚠️ The tour's window must be LARGER than the tour, so the promo is the
   * whole journey rather than its last minute — which, on a tour that spends
   * its middle playing a message, was a minute of one screen and nothing else.
   *
   * And the tour itself must fit inside `screenrecord`'s hard ceiling. The
   * first version ran 175 seconds against a 178-second cap: it was still
   * playing when the recording ended, and Speak, Tap and Learn were never
   * captured. Nothing failed; the camera ran out.
   */
  it('windows the tour past its head but inside what is recorded', () => {
    const limit = Number(
      capture(/^TIME_LIMIT=\$\{TIME_LIMIT:-(\d+)\}/mu, RECORDER, 'TIME_LIMIT'),
    );
    const window = defaultOf('TOUR_SECONDS');
    // Long enough to hold the whole journey from the welcome carousel on.
    expect(window).toBeGreaterThan(100);
    // ⚠️ And short enough to CUT the head. Every tour clip opens on about
    // twenty seconds of rubbish — the previous flow's last screen, the
    // launcher, the splash — because recording starts before Maestro does and
    // Maestro's first act is to relaunch the app. A window larger than the
    // clip put the Learn tab at the front of the promo for fifteen seconds.
    expect(window).toBeLessThan(limit - 40);
  });

  /**
   * The dwell `repeat`s are what the tour's length is made of — each iteration
   * is a real hierarchy fetch, one to two seconds on a software-rendered
   * emulator. 74 of them was most of 175 seconds.
   */
  it('keeps the tour inside its recording budget', () => {
    const iterations = [...read('tour').matchAll(/times: (\d+)/gu)].reduce(
      (sum, match) => sum + Number(match[1]),
      0,
    );
    // Two seconds each, plus the tour's own taps, typing and 22s of playback.
    expect(iterations * 2 + 70).toBeLessThan(
      Number(capture(/^TIME_LIMIT=\$\{TIME_LIMIT:-(\d+)\}/mu, RECORDER, 'TIME_LIMIT')),
    );
  });

  it.each(['GRID_SECONDS', 'TOUR_SECONDS'])('trims %s from the end', (name) => {
    expect(COMPOSE).toContain(name);
    expect(defaultOf(name)).toBeGreaterThan(0);
  });

  it('seeks both outputs relative to the end of the clip', () => {
    expect([...code(COMPOSE).matchAll(/-sseof/gu)]).toHaveLength(2);
  });

  /**
   * ⚠️ `screenrecord` encodes surface UPDATES, not wall-clock time. A screen
   * that is not changing produces no frames at all — and every flow here ends
   * by resting on its destination, which is the footage the grid uses.
   *
   * Two of four cells decoded ZERO frames after `-sseof`, `hstack` had nothing
   * to stack, and the four-up collapsed to its two end cards. tab-learn's
   * 55-second recording produced a file ending at 38s, because a container's
   * duration is only the timestamp of the last frame anything emitted.
   */
  it('normalises to a constant frame rate before trimming', () => {
    const script = code(COMPOSE);
    expect(script).toContain('fps=$FPS');
    expect(script.indexOf('fps=$FPS')).toBeLessThan(script.indexOf('-sseof'));
  });

  // And clones the final frame onto the end, so the tail exists even when
  // there was no motion for the device to record.
  it('clones a tail onto the end', () => {
    expect(code(COMPOSE)).toContain('tpad=stop_mode=clone');
  });

  /**
   * ⚠️ The clone must be SHORTER than the window it sits inside.
   *
   * Defaulting TAIL_PAD to GRID_SECONDS meant the trim window was exactly the
   * cloned still, so every cell was a freeze-frame no matter what the device
   * had actually recorded. The pad is insurance against a clip whose static
   * tail never reached the file — not a replacement for the footage.
   */
  it('pads less than it shows', () => {
    const pad = Number(capture(/^TAIL_PAD=\$\{TAIL_PAD:-(\d+)\}/mu, COMPOSE, 'TAIL_PAD'));
    expect(pad).toBeGreaterThan(0);
    expect(pad).toBeLessThan(defaultOf('GRID_SECONDS'));
  });

  /**
   * ⚠️ CLIPS specifically. The audio input is seeked from the front on
   * purpose — when the window opens part-way through the message, the tone has
   * to start part-way through too — so a blanket "no -ss" rule catches the one
   * legitimate use and hides the illegitimate ones behind it.
   */
  it('never seeks a video clip from the front', () => {
    expect(code(COMPOSE)).not.toMatch(/-ss [^|]*-i "\$CLIPS/u);
    expect(code(COMPOSE)).not.toMatch(/-ss [^|]*-i "\$NORMALISED/u);
  });

  // Each flow must hold still for at least as long as the grid shows of it, or
  // a cell spends part of its time on whatever came before.
  /**
   * ⚠️ `waitForAnimationToEnd: timeout: N` DOES NOT HOLD FOR N.
   *
   * N is a maximum. On a screen that is not animating it returns in under a
   * second. Flows written with eighteen-second "holds" raced through and
   * stopped, and the tail of each clip was whatever came next rather than the
   * screen it had reached — one four-up cell showed the app relaunching.
   *
   * The dwell comes from the recorder instead, which runs for a fixed length
   * and never stops early. So a tab flow ends the moment it has arrived, and
   * must not pretend to wait.
   */
  it.each(Object.keys(TABS))('does not ask %s to hold still', (tab) => {
    // The COMMANDS, not the file: every one of these flows explains the trap
    // in a comment, and a comment naming it must not read as committing it.
    expect(commands(read(tab))).not.toContain('waitForAnimationToEnd');
  });

  // The one place a long timeout really does hold: the screen is flashing
  // during playback, so animations never end.
  it('waits on animation only where the tour is actually animating', () => {
    const tour = commands(read('tour'));
    expect([...tour.matchAll(/waitForAnimationToEnd:/gu)]).toHaveLength(1);
    // And it comes AFTER the play button, which is what makes it hold.
    expect(tour.indexOf('waitForAnimationToEnd')).toBeGreaterThan(
      tour.indexOf("id: 'playing-badge'"),
    );
  });

  /**
   * ⚠️ A message at the DEFAULT speed finishes in about three seconds, so the
   * first recorded run asserted `playing-badge` and failed — playback had
   * already stopped. `audio-playback.yaml` encodes the same lesson, and buys
   * its duration with SPEED rather than with characters.
   */
  /**
   * ⚠️ The message must outlast the RECORDING, not merely the assertion.
   *
   * "MORSE CODE" at 5 WPM plays for 21 seconds. The recorder rests 20 and then
   * takes a while to stop, so playback finished about 24 seconds before the
   * clip ended and the grid's window landed entirely in the static aftermath —
   * a cell that was correct in every detail and completely still.
   *
   * Computed from the app's own encoder and timeline, the way
   * `maestro-flows.test.ts` does it, so the number cannot drift from what the
   * app will actually do.
   */
  /** How long a flow's typed message takes to play, per the app's own code. */
  function playbackSeconds(flow: string): number {
    const typed = /- inputText: '([^']+)'/u.exec(read(flow))?.[1];
    expect(typed).toBeDefined();
    return (toTimeline(encode(typed as string)).totalUnits * unitMsForWpm(5)) / 1000;
  }

  it('plays for longer than tab-translate is recorded', () => {
    const rest = Number(
      capture(/^REST_SECONDS=\$\{REST_SECONDS:-(\d+)\}/mu, RECORDER, 'REST_SECONDS'),
    );
    // Twice the rest, so stopping the recorder still catches it mid-flash even
    // when the teardown takes as long again as the rest itself did.
    expect(playbackSeconds('tab-translate')).toBeGreaterThan(rest * 2);
  });

  /**
   * ⚠️ The tour needs the OPPOSITE of what tab-translate needs, and confusing
   * the two cost a run.
   *
   * Its wait must expire while the message is still playing. A fifty-nine
   * second message outlived a twenty-two second wait, so the "stop" tap that
   * followed fired after playback had already ended naturally — it did not
   * stop anything, it RESTARTED it, and the tour spent its last forty seconds
   * replaying while Speak, Tap and Learn went unfilmed.
   */
  it('keeps the tour playing until its wait expires', () => {
    const waitSeconds =
      Number(
        capture(/waitForAnimationToEnd:\n\s+timeout: (\d+)/u, read('tour'), 'tour wait'),
      ) / 1000;
    expect(playbackSeconds('tour')).toBeGreaterThan(waitSeconds);
  });

  // And it must not tap the play button a second time, because what that tap
  // means depends on whether playback happens to have finished.
  it('never taps the tour out of playback', () => {
    expect([...commands(read('tour')).matchAll(/id: 'signal-button'/gu)]).toHaveLength(1);
  });

  /**
   * ⚠️ `inputText` costs about a SECOND PER CHARACTER on a software-rendered
   * emulator. Twenty-nine characters ate twenty-five seconds of a tour with a
   * 178-second ceiling — at the fifty-second mark the screen still read "O".
   */
  it('does not spend the tour typing', () => {
    const typed = capture(/- inputText: '([^']+)'/u, read('tour'), 'tour message');
    expect(typed.length).toBeLessThanOrEqual(12);
  });

  it.each(['tour', 'tab-translate'])('slows playback before signalling in %s', (flow) => {
    const source = read(flow);
    expect(source).toContain("id: 'segment-5'");
    expect(source.indexOf("id: 'segment-5'")).toBeLessThan(
      source.indexOf("id: 'signal-button'"),
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
   * ⚠️ The workflow boots with animations OFF and the recorder turns them back
   * on, which is not the contradiction it looks like.
   *
   * Animations are the subject of a video — an app recorded with its
   * transitions off looks broken rather than fast. But leaving them on for the
   * whole job made a 1080p software-rendered launcher ANR during boot, and the
   * "isn't responding" dialog then covered the app in all five clips while the
   * step still reported success. Boot cheap, record properly.
   */
  it('boots with animations off', () => {
    expect(WORKFLOW).toContain('disable-animations: true');
  });

  it.each([
    'window_animation_scale',
    'transition_animation_scale',
    'animator_duration_scale',
  ])('turns %s back on before recording', (scale) => {
    expect(RECORDER).toContain(scale);
  });

  // The ANR dialog that wasted a whole run. It covered the app in every frame,
  // and nothing failed — `continue-on-error` is what keeps partial footage.
  it('suppresses system error dialogs before recording', () => {
    expect(RECORDER).toContain('hide_error_dialogs 1');
  });

  /**
   * ⚠️ The rest must come AFTER the flow, not inside a fixed window.
   *
   * A fixed 55-second recording assumed the flows were shorter than they are.
   * tab-translate gained a Settings detour to drop the playback speed, ran past
   * its own window, and the clip ended while it was still on the opening
   * screen — nothing failed, the recording simply stopped first.
   */
  it('rests after the flow returns, then stops the recorder', () => {
    const rest = RECORDER.indexOf('sleep "$REST_SECONDS"');
    const stop = RECORDER.indexOf('pkill -INT screenrecord');
    expect(rest).toBeGreaterThan(-1);
    expect(stop).toBeGreaterThan(rest);
  });

  // The tail trim has to land inside the rest, not inside the flow.
  it('rests for at least as long as the grid shows', () => {
    const rest = Number(
      capture(/^REST_SECONDS=\$\{REST_SECONDS:-(\d+)\}/mu, RECORDER, 'REST_SECONDS'),
    );
    const shown = Number(
      capture(/^GRID_SECONDS=\$\{GRID_SECONDS:-(\d+)\}/mu, COMPOSE, 'GRID_SECONDS'),
    );
    expect(rest).toBeGreaterThanOrEqual(shown);
    // screenrecord stops dead at its own 180s ceiling.
    expect(
      Number(capture(/^TIME_LIMIT=\$\{TIME_LIMIT:-(\d+)\}/mu, RECORDER, 'TIME_LIMIT')),
    ).toBeLessThan(180);
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

/**
 * ⚠️ The soundtrack is RE-RENDERED, because `screenrecord` captures no audio.
 *
 * That makes it the one part of the video that is not evidence of anything —
 * it is generated, so it can be generated wrongly and still sound plausible.
 * These are the couplings that would let it drift from what is on screen.
 */
describe('video audio', () => {
  /** The `inputText` a recorded flow types. */
  function typedBy(flow: string): string {
    return capture(/- inputText: '([^']+)'/u, read(flow), `${flow} message`);
  }

  /** A `NAME=${NAME:-value}` default from the composer. */
  function composeDefault(name: string): string {
    return capture(new RegExp(`^${name}=\\$\\{${name}:-(.*)\\}`, 'mu'), COMPOSE, name);
  }

  /**
   * ⚠️ Audio of a DIFFERENT message than the one on screen is worse than
   * silence — it looks like the app is lying about what it is sending.
   */
  it.each([
    ['TOUR_TEXT', 'tour'],
    ['TRANSLATE_TEXT', 'tab-translate'],
  ])('renders %s from exactly what %s types', (constant, flow) => {
    expect(composeDefault(constant)).toBe(typedBy(flow));
  });

  /**
   * ⚠️ And at the speed the flow actually selects. The flows tap `segment-5`,
   * which is 5 WPM; rendering at the default 10 would produce a tone half the
   * length of the flashing it accompanies.
   */
  it('renders at the speed the flows select', () => {
    expect(composeDefault('PLAYBACK_WPM')).toBe('5');
    for (const flow of ['tour', 'tab-translate']) {
      expect(read(flow)).toContain("id: 'segment-5'");
    }
  });

  /**
   * ⚠️ `apad` without a bound pads FOREVER, and `-shortest` does not reliably
   * terminate a filter_complex output. The first version ran ffmpeg at 98% CPU
   * for forty-four minutes on a two-minute encode, generating silence it was
   * never going to stop generating.
   */
  it('bounds the audio padding', () => {
    expect(code(COMPOSE)).toContain('apad=whole_dur=');
    expect(code(COMPOSE)).not.toMatch(/apad\[/u);
  });

  /**
   * ⚠️ A window that opens PART-WAY through the message needs the tone to
   * start part-way through too. The four-up takes the last sixteen seconds of
   * a clip whose playback began ninety seconds earlier; clamping that offset
   * to zero put the sound thirty-three seconds out of step with the picture.
   */
  it('seeks into the tone when the window opens mid-message', () => {
    expect(code(COMPOSE)).toContain('AUDIO_IN=(-ss "$seek" -i "$wav")');
  });

  /**
   * ⚠️ The onset is MEASURED, not predicted. When a flow reaches the play
   * button depends on emulator speed, driver warm-up and retries.
   */
  it('detects the flash rather than computing it', () => {
    expect(code(COMPOSE)).toContain('tools/detect-playback-start.sh');
  });

  /**
   * ⚠️ And it detects OSCILLATION, not darkness. The splash screen is far
   * darker than any flash — spread 142 against 24 on a real clip — so a
   * brightness threshold picks the splash every time.
   */
  it('looks for oscillation, not a dark screen', () => {
    expect(DETECTOR).toContain('MIN_CROSSINGS');
    expect(DETECTOR).toContain('signalstats');
  });

  // The tone comes from the app's own renderer, not a reimplementation.
  it.each(['core/domain/tone', 'core/domain/timeline', 'core/domain/morse'])(
    "renders through the app's own %s",
    (module) => {
      expect(RENDERER).toContain(module);
    },
  );
});
