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
synchronises them. Two things keep them lined up:

1. Every tab flow does **identical** work before its own footage matters — the
   same launch, the same guide dismissal, one tab tap. `tab-translate.yaml`
   taps the tab it is already on, purely to keep its lead-in the same length as
   the other three.
2. `compose-video.sh` trims a fixed `LEAD_IN` (default 6s) off all four.

`video-assets.test.ts` asserts that lead-in **in full**, per flow, rather than
comparing the flows to each other — three flows that drifted together would
pass a comparison.

If the grid opens on the welcome carousel, raise `LEAD_IN`. If a cell has
finished its business before the others start, lower it. Neither needs a
re-record:

```bash
LEAD_IN=8 GRID_SECONDS=14 tools/compose-video.sh clips video
```

---

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
