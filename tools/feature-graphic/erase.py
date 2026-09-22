"""Paint the fitted background gradient over a box, erasing whatever was there.

Used to remove the English tagline before drawing a translated one. The model
is a plane per channel, fitted by least squares from the image BORDERS, which
carry no artwork. It reproduces an interior band it never saw to within 0.51
levels, so the repainted box is indistinguishable from the surrounding
background rather than a visible patch.
"""
import io
import json
import os
import subprocess
import sys

src, dst, bx, by, bw, bh = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:7])
W, H = 1024, 500

coef = json.load(io.open(os.path.join('tools', 'feature-graphic', 'gradient.json')))

raw = subprocess.run(
    ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', src,
     '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    capture_output=True, check=True).stdout
d = bytearray(raw)

for y in range(by, by + bh):
    for x in range(bx, bx + bw):
        i = (y * W + x) * 3
        for ch in range(3):
            a, b, c = coef[ch]
            v = a + b * x + c * y
            d[i + ch] = 0 if v < 0 else (255 if v > 255 else int(round(v)))

subprocess.run(
    ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
     '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-i', '-',
     '-frames:v', '1', dst],
    input=bytes(d), check=True)
