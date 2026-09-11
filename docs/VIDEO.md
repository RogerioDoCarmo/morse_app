# Videos

Two moving-image assets, both recorded from the app as it actually runs and
composed by [`tools/compose-video.sh`](../tools/compose-video.sh). Produced by
the **Videos** workflow — Actions → Videos → Run workflow.

| Output | Where it goes | Shape |
| --- | --- | --- |
| `promo-youtube.mp4` | YouTube, whose URL goes in Play Console | 1920×1080, ~45s |
| `linkedin-fourup.mp4` | a LinkedIn post | 1920×1080, ~20s |

Both come out of the artifact `store-videos`. The raw portrait recordings come
out separately as `store-videos-raw-clips`, so a change of mind about framing
costs seconds of ffmpeg rather than another forty minutes of recording:

```bash
tools/compose-video.sh <unzipped-clips-dir> <output-dir>
```

---

## The Play promo video

⚠️ **Play does not accept a video upload. It takes a YouTube URL**, and that
one fact decides everything else here.

Store listing → **Video**. Paste the full watch URL:

```text
https://www.youtube.com/watch?v=VIDEO_ID
```

Five things reject it or make it disappear, none of which Play explains well:

- ⚠️ **Strip every extra parameter.** A URL carrying `&list=`, `&t=` or an
  `?si=` from the share button is rejected. The share button produces a
  `youtu.be` short link, which is also not what the field wants.
- ⚠️ **Not private.** Public or unlisted. A private video validates as a URL
  and then shows nothing to anybody.
- ⚠️ **Not age-restricted**, or Play cannot display it.
- ⚠️ **No ads on it.** Turn monetisation off for this video specifically.
- ⚠️ **The feature graphic becomes the thumbnail.** Play does not autoplay; it
  shows the feature graphic with a play button over it. A video without a
  feature graphic has nothing to sit on, which is why
  `docs/store-listing/graphics/play-feature-graphic.png` is not optional once
  a video is set.

Google suggests 30 seconds to 2 minutes. This one lands around 45.

## The LinkedIn four-up

All four tabs running at once, side by side in one frame, with the feature
graphic at each end. LinkedIn autoplays **muted** in the feed, so the asset has
to work with no sound at all — which is exactly what a grid of four screens
doing four visible things does, and what a narrated walkthrough does not.

| | |
| --- | --- |
| Container | MP4, H.264 video, AAC audio |
| Aspect | between 1:2.4 and 2.4:1 — 16:9 is comfortably inside |
| Length | 3s to 30min; the feed rewards well under 90s |

---

## ⚠️ There is no sound, and there cannot be

`adb shell screenrecord` captures video only. There is no flag for audio, so
footage of an app whose headline feature is playing Morse as **sound** arrives
mute. This is a real weakness in the promo and it is worth deciding about
rather than discovering:

- **Add a soundtrack on YouTube.** Play takes a URL, so the audio is a property
  of the upload rather than of this repository. This is the cheap fix.
- **Leave it silent.** Defensible for LinkedIn, which autoplays muted anyway.

The composer does add a **silent** AAC track to both files. That is not an
attempt to fix the above — it is because a file with no audio stream at all is
rejected or quietly re-encoded by several upload pipelines, and diagnosing that
from the far side of an upload form is miserable.

---

## How the four-up stays in step

The four cells are four separate recordings played simultaneously. Nothing
synchronises them.

⚠️ **Both outputs are trimmed from the END of the clip, never the front**, and
that is the whole trick. Everything variable in a recording happens at the
front — emulator boot, Maestro's driver install, the app launch, and any
retries a flow needed. What is worth watching is at the end, where every flow
holds still on purpose.

The first attempt trimmed a fixed six seconds off the front. A run where the
flows retried twice pushed all the content fifty seconds later, and the trim
was wrong by about that much. Trimming from the end makes startup time
irrelevant, and it degrades kindly: ask for more seconds than a clip has and
ffmpeg hands back the whole clip.

Every tab flow's declared holds add up to at least `GRID_SECONDS`, so a cell
never runs out and falls back onto whatever preceded it. `video-assets.test.ts`
checks that sum per flow.

Re-framing costs seconds of ffmpeg, not another run:

```bash
GRID_SECONDS=20 TOUR_SECONDS=75 tools/compose-video.sh clips video
```

## ⚠️ The launcher will ANR if animations are on during boot

The first run that recorded anything produced five clips with **"Pixel Launcher
isn't responding"** sitting on top of every frame. A `pixel_6` profile at 1080p
through swiftshader, with animations on for the whole job, is heavy enough to
ANR the launcher — and the dialog then covered the app, so Maestro could not
see `first-run` and every flow failed through its retries.

⚠️ **The step still reported success.** `continue-on-error` is what keeps
partial footage when a flow falls over, and it also swallows this. The only
evidence was in the footage itself, which is why it is worth looking at a frame
of any new recording rather than trusting a green tick.

Two things prevent it now, both in
[`tools/record-video-clips.sh`](../tools/record-video-clips.sh):

- `settings put global hide_error_dialogs 1`, plus a BACK and a HOME to
  dismiss anything already up.
- **Animations are switched on by the recorder rather than by the workflow.**
  The job boots with `disable-animations: true` so the launcher settles
  cheaply, and the three animation scales go back to 1 just before recording.
  Boot cheap, record properly.

## ⚠️ The emulator action runs its script one line at a time

`reactivecircus/android-emulator-runner` does **not** run its `script:` block
as a script. It splits it on newlines and runs each line through its own
`sh -c`, so anything spanning more than one line is torn apart:

```text
/usr/bin/sh: 1: Syntax error: end of file unexpected (expecting "}")
```

The first run of this workflow recorded **nothing at all** because a shell
function was written in that block directly — forty minutes of build and
emulator time to find out, and the error named the line *after* the one that
opened the brace. The screenshots job never hit it because both of its lines
stand alone.

So: **every line in that block must be a complete command on its own.**
Anything with more than one step goes in a file, which is what
[`tools/record-video-clips.sh`](../tools/record-video-clips.sh) is.
`video-assets.test.ts` fails the build if a line there ends in `\`, `{`,
`do`, `then` or a pipe.

## Why the recordings look the way they do

- ⚠️ **The Light channel is never switched on**, in any recorded flow. It
  raises the camera permission dialog, and a system dialog in the middle of a
  published video is a rejection waiting to happen. `video-assets.test.ts`
  fails if `channel-light` appears in any of them.
- ⚠️ **Animations are left ON.** Every other device job in this repository
  disables them, because they make flows flaky. Here they are the subject: an
  app recorded with its transitions turned off looks broken rather than fast.
- **Speak does not listen.** There is no microphone on a CI emulator, so
  tapping the mic would produce a permission dialog and then a recogniser that
  hears nothing. The cell shows the idle screen, which is honest.
- **The emulator is a `pixel_6` profile**, 1080×2400. The default is 320×640 —
  which is what the first full set of Android store screenshots was captured
  at, Play's absolute minimum for the short side.
- **The flows are paced for watching.** Every `waitForAnimationToEnd` is a
  deliberate hold. The flows in `.maestro/flows/` race through the same taps
  and would produce footage nobody could follow.
