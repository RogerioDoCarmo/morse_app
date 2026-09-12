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

window = int(float(os.environ['FPS']) * float(os.environ['WINDOW_S']))
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
    # oscillation became measurable. The anchor is the first sample inside it
    # that actually goes dark, which is the first MARK.
    onset = next((tt for tt, y in rows[i:i + window] if y < mid), rows[i][0])
    print(f'{onset:.3f}')
    break
PY
