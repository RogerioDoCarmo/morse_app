# Store listing — en-US

English (default). Paste-ready: every fenced block below is exactly what goes in the
matching store field, and nothing else in this file is.

| Block | Google Play | App Store Connect |
| --- | --- | --- |
| App name | App name — 30 | Name — 30 |
| Short description | Short description — 80 | — |
| Subtitle | — | Subtitle — 30 |
| Keywords | — | Keywords — 100 |
| Promotional text | — | Promotional Text — 170 |
| Full description | Full description — 4000 | Description — 4000 |
| Release notes | What's new — 500 | What's New in This Version — 4000 |

Three blocks serve both stores, and that is deliberate: copy kept twice is copy
that disagrees with itself eventually. Where the two limits differ, Play's is
the tighter one and fits inside Apple's either way — so the shorter limit is the
one that governs.

The file is named for Play's locale code. App Store Connect calls this same
language **English (U.S.)**.

`store-listing.test.ts` fails the build if a block outgrows its field — copy
that is too long is rejected at paste time, one field at a time, in a browser.

See [PLAY-CONSOLE.md](../../docs/PLAY-CONSOLE.md) and [APP-STORE.md](../../docs/APP-STORE.md)
for the answers that are not per language.

## App name

```text
OmniMorse
```

## Short description

```text
Encode. Decode. Learn. Morse by sound, light, screen or vibration.
```

## Subtitle

The punchline, verbatim. It fits in 22 of Apple’s 30 characters, which is
the only language where it does.

```text
Encode. Decode. Learn.
```

## Keywords

App Store only. Comma-separated with no spaces — a space after a comma is a
character Apple counts and nothing gains by it. Apple pairs keywords into
phrases by itself, so morse and code already cover the search "morse code".

Under the limit on purpose. Filling the last characters with weaker terms is
the same mistake as a fourth Play tag: an install that bounces is the worst
signal a new app can send.

```text
morse,code,translator,cw,telegraph,sos,signal,beacon,dots,dashes,ham,radio,decoder,alphabet
```

## Promotional text

App Store only, and the one field that can be changed WITHOUT shipping a build
or waiting for review. It sits above the description. Use it for whatever is
worth saying this month; the description is what stays.

```text
Four ways to send a message: sound, the camera flash, the screen, or vibration. Switch any of them on or off while it plays. Tap a letter to hear just that one.
```

## Full description

```text
OmniMorse turns text into Morse code and Morse code back into text.

Type a message and watch it become dots and dashes letter by letter. Say it out loud and let the phone transcribe it. Or tap it in yourself on a key that measures how long you hold it — press briefly for a dot, hold for a dash — with a cut-off you can set to match your own speed.

FOUR WAYS TO SEND IT

A message can go out as sound, as the camera flash, as a flashing screen, or as vibration. Switch any of them on or off, even while a message is playing. They run together, in step, from one clock.

LEARN IT PROPERLY

Tap any letter to hear just that one — the quickest way to learn the rhythm. The Learn tab has the full alphabet, the timing rules that make the silences matter as much as the marks, and five things that actually work for memorising it.

IN YOUR LANGUAGE

The whole interface is in English, Brazilian Portuguese and Spanish. So is speech input, where your device supports it.

PRIVATE BY DEFAULT

No account. No advertising. No analytics. Nothing you type, say or key ever leaves your phone. The app sends anonymous crash diagnostics so failures can be fixed, and you can switch that off in Settings.
```

## Release notes

For 0.3.4 (11) on Play and 0.3.4 (13) on the App Store. Replace for each release; keep the shape.

```text
• The language button works. Tap it to pick English, Portuguese or Spanish.
• App language and speech recognition are separate settings now — changing one no longer changes the other.
• Copy puts the Morse on the clipboard and confirms it.
• New Clear all and Paste buttons under the text field.
• The flashing circle is no longer covered by the progress bar.
• On iPhone, stopping playback actually stops it.
• Settings switches say what they changed.
```
