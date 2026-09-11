# Video flows

⚠️ **Not in `flows/`, and not in `screenshots.yaml` either.** `pnpm test:e2e`
runs `flows/` on every PR; these assert almost nothing and exist to be
*recorded*, so they would add minutes to every run for footage nobody watched.

Run them from [`videos.yml`](../../.github/workflows/videos.yml), or locally
against a booted emulator:

```bash
maestro test .maestro/video/tour.yaml
```

| Flow | Recorded into |
| --- | --- |
| `tour.yaml` | the Play Console promo video, via YouTube |
| `tab-translate.yaml` | the left cell of the LinkedIn four-up |
| `tab-speak.yaml` | the second cell |
| `tab-tap.yaml` | the third cell |
| `tab-learn.yaml` | the right cell |

## Why the four tab flows share an identical preamble

They are recorded as four separate runs and then played **simultaneously**,
side by side, in one frame. Nothing synchronises them, so the only thing
keeping the four phones roughly in step is that each does the same work before
its own footage starts to matter: the same launch, the same guide dismissal,
the same single tab tap.

`tools/compose-video.sh` trims a fixed lead-in off all four. Change the
preamble in one flow and not the others and the grid drifts — the cells do not
fail, they just stop lining up, which is the kind of thing that is only
noticeable once it is published.

## Why Translate taps its own tab

It is already on the Translator when the guide closes, so the tap is
redundant — and that is the point. Four flows, four taps, four identical
lead-ins.
