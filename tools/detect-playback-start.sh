#!/usr/bin/env bash
#
# Prints the second at which Morse playback starts in a recording, or nothing
# when it never does.
#
#   tools/detect-playback-start.sh clips/tour.mp4
#
# ⚠️ Measured from the FOOTAGE, not computed from the flow. Everything about
# when a flow reaches the play button is variable — emulator speed, driver
# warm-up, retries — and the audio has to land on the frame the screen
# actually starts flashing, not on the frame it was predicted to.
#
# ⚠️ It looks for OSCILLATION, not darkness. The splash screen is far darker
# than any flash (spread 142 against 24 on a real clip) and a brightness
# threshold picks it every time. What only playback does is alternate.
set -euo pipefail

CLIP=${1:?usage: detect-playback-start.sh <clip.mp4>}

FPS=${FPS:-30}
# Three seconds: long enough to hold several marks at the slowest speed the
# app offers, short enough not to smear the onset.
WINDOW_S=${WINDOW_S:-3}
# The flashing surface covers roughly a sixth of the screen, so a real flash
# moves average luminance by about 24 of 255 — nothing like a scene change.
MIN_SPREAD=${MIN_SPREAD:-12}
MIN_CROSSINGS=${MIN_CROSSINGS:-6}

stats=$(mktemp)
trap 'rm -f "$stats"' EXIT
ffmpeg -hide_banner -loglevel error -i "$CLIP" \
  -vf "fps=$FPS,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" \
  -f null - 2>/dev/null > "$stats"

FPS="$FPS" WINDOW_S="$WINDOW_S" MIN_SPREAD="$MIN_SPREAD" MIN_CROSSINGS="$MIN_CROSSINGS" \
python3 - "$stats" <<'PY'
import os, re, sys

rows, t = [], None
for line in open(sys.argv[1]):
    m = re.match(r'frame:\s*\d+\s+pts:\s*\d+\s+pts_time:([\d.]+)', line)
    if m:
        t = float(m.group(1))
    m2 = re.search(r'YAVG=([\d.]+)', line)
    if m2 and t is not None:
        rows.append((t, float(m2.group(1))))

fps = int(float(os.environ['FPS']))
window = int(fps * float(os.environ['WINDOW_S']))
spread_min = float(os.environ['MIN_SPREAD'])
crossings_min = int(os.environ['MIN_CROSSINGS'])

for i in range(max(0, len(rows) - window)):
    ys = [y for _, y in rows[i:i + window]]
    lo, hi = min(ys), max(ys)
    if hi - lo < spread_min:
        continue
    mid = (lo + hi) / 2
    crossings = sum(1 for a, b in zip(ys, ys[1:]) if (a < mid) != (b < mid))
    if crossings < crossings_min:
        continue
    # ⚠️ The window START is up to WINDOW_S early — it is merely where the
    # oscillation became measurable. The anchor is the first frame that sits
    # at one of the two levels the MARKS oscillate between.
    #
    # ⚠️ Two earlier anchors were both wrong, and the composed promo shows why.
    # Frame by frame on a real clip, the screen goes:
    #
    #     ...-77.333   219.09   steady, before playback
    #     77.367       220.30   the surface mounting and the progress row
    #                           appearing — a LAYOUT change, not a mark
    #     77.700       224.21   the first MARK, 0.667s = a 720ms dash
    #     78.400       200.32   the first GAP, 0.267s = 240ms
    #
    # Anchoring on the first sample below the midpoint returned 78.400: the
    # first gap, one whole mark late, and the soundtrack shipped 0.734s behind
    # the picture. Anchoring on the first departure from the steady baseline
    # returns 77.367: the layout swap, a third of a second early.
    #
    # Playback occupies exactly two levels and the transition into it occupies
    # neither, so the onset is a frame that REACHES one of them. It has to be
    # the BRIGHT one.
    #
    # ⚠️ "Either level" is not good enough, and the grid clip proves it. There
    # the surface mounts UNLIT for 0.2s before the first mark renders:
    #
    #     108.200   216.93   steady
    #     109.267   218.15   layout swap
    #     109.633   199.46   the surface, mounted and DARK
    #     109.833   222.85   the first mark
    #
    # The tour clip goes straight from the swap to a mark and never shows
    # that dark frame. Accepting either level therefore anchors the tour
    # correctly and the grid 0.2s early.
    #
    # ⚠️ So this DOES depend on the app lighting its surface for a mark. An
    # earlier attempt at polarity independence is what produced the 0.7s
    # error being fixed here — it treated a dark frame as a mark. If the app
    # ever draws a dark-on-light surface, this needs revisiting deliberately,
    # with a clip to measure against; it should not be generalised on a guess.
    tol = (hi - lo) * 0.10
    # ⚠️ The baseline comes from before the SCAN, not from before `i`.
    #
    # `i` is where six crossings had accumulated, which on a real clip was
    # 78.300 — after playback had already been running for 0.6s. Sampling the
    # second before `i` gave a median of 224.2, the LIT level itself, and the
    # "different from the still screen" test then rejected every mark for
    # being identical to the baseline. It returned the first gap again, which
    # is the exact bug this rewrite exists to remove.
    scan_from = max(0, i - window)
    pre = rows[max(0, scan_from - fps):scan_from]
    ys_pre = sorted(y for _, y in pre) if pre else []
    baseline = ys_pre[len(ys_pre) // 2] if ys_pre else None

    def is_playback(y: float) -> bool:
        lit = y >= hi - tol
        if baseline is None:
            return lit
        # ...and genuinely different from the still screen before it, so a
        # resting screen that happens to sit near the lit level cannot
        # anchor it.
        return lit and abs(y - baseline) > tol

    # Searched from a window EARLIER than the one that qualified: six crossings
    # take a couple of seconds to accumulate, so the window that first meets
    # the test can begin after the opening mark.
    scan = rows[scan_from:i + window]
    onset = next((tt for tt, y in scan if is_playback(y)), rows[i][0])
    print(f'{onset:.3f}')
    break
PY
