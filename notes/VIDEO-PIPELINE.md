# Where the videos are actually made

Short answer: **on GitHub's servers, not on your Mac.** Nothing about the
recording touches this machine, and that is deliberate.

[VIDEO.md](VIDEO.md) is the reference for the pipeline and every trap in it.
This file answers a different question — *which computer does what, why, and
what it costs* — because "run the workflow" hides a lot.

---

## The machines

```text
your Mac                 GitHub's runner (ubuntu-latest)
────────                 ───────────────────────────────
gh workflow run  ──────▶  1. check out the repo
                          2. build the app        ← Gradle, ~9 min
                          3. install ffmpeg
                          4. boot an Android EMULATOR   (a virtual phone,
                             ├─ install the APK          running inside
                             ├─ Maestro drives the app   the runner)
                             └─ screenrecord captures it
                          5. ffmpeg composes the two videos
                          6. upload them as artifacts
gh run download  ◀──────
```

Every step from 1 to 6 happens on a machine GitHub rents you for the duration
of the run and then destroys. Your Mac only sends the "go" and downloads the
result.

### There is a real phone in there, sort of

The thing being recorded is an **Android emulator** — a virtual phone booted
inside the Linux runner. `pixel_6` profile, 1080×2400, API 34, no screen
attached (`-no-window`), with the graphics done in software by swiftshader
because a rented Linux box has no GPU.

Maestro taps and swipes it exactly as it does in the E2E tests, and
`adb shell screenrecord` captures the virtual display. The recording is written
*on the emulator's own storage* (`/sdcard/...`) and then pulled onto the runner
with `adb pull`, which is why the recorder script has to wait for the file to
finalise before copying it.

---

## Why not locally?

Three reasons, in order of how much they matter.

1. **The build already lives there.** Recording needs an installed release APK,
   which needs a full Gradle build with the Firebase credentials in place. CI
   does that on every screenshots run already, from a shared action. Doing it
   locally means doing it locally *every time*.
2. **This machine goes back on Monday 14 September 2026.** That was the stated
   reason for writing [MACHINE-SETUP.md](MACHINE-SETUP.md) when the date was
   still vague, and it applies here doubly now: a pipeline that only runs on
   one Mac is a pipeline that stops when the Mac does — and the date is known.
   Everything in this document runs on GitHub's runners for exactly that
   reason.
3. **It is reproducible.** The same emulator profile, the same Android version,
   the same ffmpeg, every time. A local run would use whatever emulator images
   and ffmpeg build happen to be installed.

⚠️ **It is free, and that is worth knowing.** This repository is **public**, so
GitHub Actions minutes cost nothing. Unlike EAS builds — which are a shared
credit pool that ran out on 9 September and does not reset until 1 October —
there is no budget reason to be sparing with runs.

The real cost is **time**: about 20 minutes, of which roughly nine are the
Gradle build and most of the rest is the emulator.

---

## What you CAN do locally, and should

⚠️ **Composing is not recording.** They are separate stages, and only the
recording needs an emulator. `tools/compose-video.sh` is plain ffmpeg and runs
on your Mac in seconds.

That matters because **re-framing does not need a re-run.** Every run uploads
the raw portrait recordings as their own artifact for exactly this reason:

```bash
gh run download <run-id> -n store-videos-raw-clips -D clips
tools/compose-video.sh clips video
```

Change the framing without touching CI at all:

```bash
GRID_SECONDS=20 TOUR_SECONDS=75 tools/compose-video.sh clips video
```

This is not a hypothetical. The fix that took the four-up from four seconds to
twenty was written and proven this way, against the real clips from a finished
run — no rebuild, no emulator, seconds per attempt.

### Recording locally is possible, just rarely worth it

If you ever need it: build and install a release APK on a booted emulator or a
plugged-in phone, then

```bash
tools/record-video-clips.sh clips
```

It talks to whatever `adb` is talking to. On a real phone the footage is
better — a genuine GPU, real animation timing, and none of the swiftshader
slowness that made the launcher ANR in CI. The cost is that it is manual, and
that the clips then depend on which phone you used.

---

## Reading a finished run

⚠️ **Do not trust the run's conclusion.** Four runs have reported `success`
while producing unusable footage — `continue-on-error` on the emulator step
preserves partial footage when a flow falls over, and it swallows five flows
failing in a row just as quietly.

**Verification is looking at a frame:**

```bash
gh run download <run-id> -n store-videos-raw-clips -D clips
ffmpeg -sseof -3 -i clips/tab-translate.mp4 -frames:v 1 frame.png && open frame.png
```

| Artifact | What it holds |
| --- | --- |
| `store-videos` | the two finished 1920×1080 files |
| `store-videos-raw-clips` | the five raw portrait recordings |

Both are kept for 30 days.
