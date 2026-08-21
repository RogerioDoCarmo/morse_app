# AGENTS.md — read this before doing anything

## 🛑 STOP: this project starts with UI design, not code

**Do NOT scaffold the app, install dependencies, or write configuration on the first
session.** The user has explicitly decided that the UI is sketched *before* the
foundation is built.

### Your first action in a fresh session

1. **Ask the user to start the UI design.** Invoke the `design` skill and guide them
   through sketching the screens on a design canvas.
2. **Iterate on the design with them** until they're satisfied.
3. **Only then** build the foundation, using `FOUNDATION.md` as the blueprint.

Ask before assuming the design phase is complete. If the user says they want to skip
straight to scaffolding, that's their call — but do not skip it silently.

### Screens to sketch (minimum)

| Screen | Purpose |
| --- | --- |
| Translator | The core screen: text input → Morse output, visual dot/dash display, flash toggle |
| Speech input | Microphone capture → transcription → Morse |
| Tap input (decode) | Single-button Morse entry → decoded text, read aloud via TTS |
| Settings | Dot/dash threshold (**must be user-configurable**), locale, playback speed |
| Learn / About Morse | Informational content explaining Morse code |
| Tips | How to learn and memorise Morse |
| Permission gates | Camera (torch) and microphone rationale states |

The translator screen needs a **text ⇄ Morse mode toggle** — both directions are in scope.
Settle that layout at sketch time; it is expensive to retrofit.

---

## Expo HAS CHANGED

Read the exact versioned docs at <https://docs.expo.dev/versions/latest/> before writing
any code. Pin to the SDK version actually installed once the project is scaffolded, the
way `mirror_app` pins to `v54.0.0`.

---

## What this project is

A **Morse code translator** for Android and iOS:

- **Typed text → Morse**, rendered as visual dots and dashes on screen
- **Speech → Morse**, via device speech-to-text
- **Flash output** — plays the Morse pattern on the device torch
- **Morse → text** via **tap input** (press duration = dot/dash), with a
  **user-configurable** dot/dash threshold
- **Text-to-speech** — decoded text is read aloud (output-only, needs no permission)
- **Informational pages** — what Morse code is, and tips for learning it
- **Bilingual input**: English (default) and Portuguese, for both typed *and* spoken input

## Foundation

The engineering foundation is inherited from `mirror_app` (Miroji), a sibling project in
`../mirror_app`. **`FOUNDATION.md` in this repo is the blueprint** — hexagonal
architecture, the four testing tiers, CI/CD, git conventions, and the store-readiness
practices, including the hard-won lessons that are easy to get wrong.

Read `FOUNDATION.md` before scaffolding. Read the real `../mirror_app` source when a
concrete example helps — its `ARCHITECTURE.md` and `COMMANDS.md` are worth copying the
shape of.
