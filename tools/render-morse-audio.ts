/**
 * Renders the exact audio the app plays, as a WAV, for muxing onto a recording.
 *
 *   npx -y tsx tools/render-morse-audio.ts "MORSE CODE" 5 out.wav
 *
 * ⚠️ This calls the APP'S OWN encoder, timeline and tone renderer — not a
 * reimplementation of them. `adb shell screenrecord` cannot capture audio at
 * all, so a promo for an app whose headline feature is playing Morse as SOUND
 * arrives silent. Re-rendering from the same source of truth the app plays
 * from is the difference between a soundtrack that IS the message and one that
 * merely sounds like it: change the encoder and this follows, because it is
 * the same code.
 */
import { writeFileSync } from 'node:fs';

import { encode } from '../src/core/domain/morse';
import { toTimedSegments, toTimeline, unitMsForWpm } from '../src/core/domain/timeline';
import { renderWav } from '../src/core/domain/tone';

const [, , text, wpmArg, outPath] = process.argv;

if (!text || !wpmArg || !outPath) {
  console.error('usage: render-morse-audio.ts <text> <wpm> <out.wav>');
  process.exit(1);
}

const wpm = Number(wpmArg);
if (!Number.isFinite(wpm) || wpm <= 0) {
  console.error(`Not a playback speed: ${wpmArg}`);
  process.exit(1);
}

const unitMs = unitMsForWpm(wpm);
const timeline = toTimeline(encode(text));
const segments = toTimedSegments(timeline, unitMs);

// ⚠️ The first segment must be a MARK, with no leading silence, or the mux
// offset below is wrong by however long that silence is. It is an assertion
// rather than a comment because the whole alignment rests on it.
if (segments.length === 0 || !segments[0]?.on) {
  console.error('The timeline does not open on a mark; the offset would be wrong.');
  process.exit(1);
}

const totalMs = segments.reduce((sum, segment) => sum + segment.ms, 0);
writeFileSync(outPath, renderWav(timeline, { unitMs }));

// Printed for the composer to read: it needs the duration to know whether the
// audio outlives the window it is being muxed into.
console.log(
  JSON.stringify({ text, wpm, unitMs, seconds: totalMs / 1000, path: outPath }),
);
