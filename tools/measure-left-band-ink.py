#!/usr/bin/env python3
"""Fraction of the left band of a frame that differs from its background.

Reads raw 8-bit grayscale from stdin, writes one number to stdout.
Driven by WIDTH, HEIGHT and DIFF in the environment.

⚠️ THIS IS A SEPARATE FILE SO IT CAN BE TESTED. It began inside
`check-two-column-art.sh` as a `python3 -c` string fed by ffmpeg, which made
its behaviour reachable only by rendering a PNG — and ubuntu-latest has no
ffmpeg, so the test would have skipped in CI and told us nothing. Raw bytes on
stdin need neither: the tests synthesise a band directly and pin the numbers.

The band is the left 45% of the frame, between 20% and 80% of its height --
where the two-column welcome layout puts the illustration. Sampled every third
pixel, which is 9x less work and changes the fraction by well under a percent.

The background is the MODE of the band, not its mean. A mean is dragged by the
illustration itself, so a frame with more art would measure a background closer
to the art and report less of it -- backwards.
"""
import os
import sys
from collections import Counter

STEP = 3


def measure(data, width, height, diff):
    x1 = int(width * 0.45)
    y0, y1 = int(height * 0.20), int(height * 0.80)
    band = [
        data[y * width + x]
        for y in range(y0, y1, STEP)
        for x in range(0, x1, STEP)
    ]
    if not band:
        return 0.0
    # ⚠️ THE BACKGROUND COMES FROM THE WHOLE FRAME, NOT FROM THE BAND.
    # Taken from the band, it inverts once the art covers more than half of it:
    # the art becomes the commonest value, is adopted as the background, and the
    # ground left around it is reported as the "art". A band filled edge to edge
    # with illustration then measures ZERO -- the same answer as a blank one,
    # for the opposite reason. The tests pin both cases.
    #
    # The frame is mostly ground in every layout this runs on, so its mode is
    # the ground whatever the left column is doing.
    background = Counter(data[::STEP * STEP]).most_common(1)[0][0]
    # Strictly greater: a pixel exactly `diff` from the background is
    # background as far as this is concerned.
    return sum(1 for p in band if abs(p - background) > diff) / len(band)


if __name__ == '__main__':
    print('%.5f' % measure(
        sys.stdin.buffer.read(),
        int(os.environ['WIDTH']),
        int(os.environ['HEIGHT']),
        int(os.environ['DIFF']),
    ))
