# Design

UI design phase for the Morse translator, run before any scaffolding (see `../AGENTS.md`).

## Direction — settled 2026-08-21

**D · Practice Deck**, executed modern. The four candidates are archived in `options/`.

| | Direction | |
| --- | --- | --- |
| A | Telegraph Desk | paper, brass, inked marks |
| B | Signal Lamp | dark instrument, amber pulse |
| C | Dot & Dash | oversized marks, editorial |
| **D** | **Practice Deck** | **cards, learning-forward — chosen** |

## Visual system

| | |
| --- | --- |
| Type | Plus Jakarta Sans (UI), DM Mono (Morse strings and codes) |
| Ink | `#101820` · muted `#6a7480` · faint `#9aa3ad` |
| Ground | `#f5f6f8` · surface `#ffffff` · border `#eef0f3` |
| Accent | `#12a594` · tint `#e7f6f3` · deep `#0d7d70` |
| Radii | cards 22 · controls 14–16 · pills 999 |
| Shadow | `0 1px 2px rgba(16,24,32,.04), 0 10px 26px rgba(16,24,32,.05)` |
| Hit target | 44px floor, everywhere |

Icons are stroke SVG on a 24px grid — never emoji.

## Layout

Phone is 390×844. Settings, Learn and Tips are drawn at full content height because
they scroll; they are not 844pt screens.

Tablet is 1180×820 landscape and adds no new screens. Two rules:

1. The bottom tab bar becomes a left rail (same four destinations; settings moves to
   the foot of the rail).
2. What the phone stacks vertically splits into panes — Translator becomes
   input | output, Learn puts prose beside the reference grid (4 columns → 6).

## Folders

| | |
| --- | --- |
| `screens/` | the live design — every app screen, phone and tablet |
| `directions/` | the four direction candidates, kept as the decision record |
| `options/` | 3× PNG renders of those four candidates |
| `screens/renders/` | 2× PNG renders of every screen |

`*.dc.html` are Design Component artboards — the editable canvas source. `canvas.json`
lays them out, names the pages, and picks the launch view.

To change the design: edit the `.dc.html` files, re-seed the canvas with the `design`
skill's helper, and republish to the same artifact URL. Never hand-edit the seeded
output.

## Settled at sketch time

- Text ⇄ Morse toggle lives on the Translator screen; both directions in scope
- Phone **and** tablet layouts
- Clickable prototype, not static mockups — press *duration* on the tap key is real
- **Trilingual UI** — English, Português (Brasil), Español. The whole interface
  translates, not just the input
- App name still open — "Morse" is a placeholder wordmark, not a proposal

## Localisation

Three interface languages: **English** (default), **Português (Brasil)**, **Español**.

`Language.dc.html` is the picker. Interface locale and speech-recognition locale are
**separate settings** — recognition follows the interface by default but can be
overridden, because a device may not have every recogniser installed.

`TranslatorPtBr.dc.html` and `TranslatorEs.dc.html` are the English Translator with only
the strings swapped, so any layout difference between them is purely string length.
That comparison earns its keep: it caught the Morse card's header row putting its label
and hint on one line with no shrink protection — fine in English at 390pt, colliding at
360pt in Portuguese. Both now shrink and wrap.

**Check narrow widths in the longest locale, not the default one.** Every phone frame is
verified at 360pt as well as 390pt.

**Accented letters — decided.** `Ç` (`-.-..`), `É` (`..-..`) and `Ñ` (`--.--`) have real
ITU codes and are supported; every other diacritic is sent as its base letter. `Ñ` and
`Ç` are distinct letters rather than decoration (`año` ≠ `ano`), and the rest have no
standard code, so inventing one would be unreadable to any other operator. All three
appear in the Learn alphabet, with a footnote stating the rule. See `FOUNDATION.md`
§Localisation for what this does to the round-trip invariant.

## Conventions the code settled

**Word separator: ` / `.** The artboards originally showed three spaces between
words in the mono line. The code uses the ITU convention instead, and the artboards
now follow it — the string sits behind a Copy button, and whitespace runs collapse
when pasted while a slash does not. `decode` accepts both on the way in, since a
human tapping one out will produce spaces.

**Seed content is per-locale.** The artboards show "Hello world" / "Boa noite" /
"Hola mundo"; the app reads the same strings from `translator.sample` rather than
hardcoding English, so the sample can never contradict the language label above it.
The Portuguese sample is deliberately accent-free — the encoder folds anything
outside `Ç É Ñ`.

> Mockups need content to show; a shipping app may not want any. Whether the
> Translator should instead open **empty** is still open, and depends on the empty
> state below.

## Not yet designed

Onboarding / first run, empty and error states beyond the permission gates, dark mode.
