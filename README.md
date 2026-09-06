# Morse

A Morse code translator for Android and iOS. Type or speak, watch it as dots and dashes,
play it on the torch — and tap it back in to decode.

> **Morse** is a placeholder wordmark, not the final app name.

## Status

Design phase complete; foundation scaffolded. The full UI is not built yet — see
[design/](design/) for the screen set the implementation follows.

## What it does

- Typed text → Morse, rendered as dots and dashes on screen
- Speech → Morse, via device speech-to-text
- Flash output — plays the pattern on the device torch
- Morse → text by **tap input**: press duration distinguishes dot from dash, with a
  user-configurable cut-off
- Decoded text read aloud (output only — no permission needed)
- Learn and Tips pages
- **Three interface languages**: English, Português (Brasil), Español

## Getting started

```bash
pnpm install
```

```bash
pnpm start
```

See [COMMANDS.md](COMMANDS.md) for everything else, and [ARCHITECTURE.md](ARCHITECTURE.md)
for how the layers fit together.

## Permissions

Two, both genuinely used:

| Permission | Why |
| --- | --- |
| `CAMERA` | the torch. There is no separate torch permission on either platform |
| `RECORD_AUDIO` | speech input |

A release-only manifest source set strips everything else that bundled libraries inject.
Nothing is uploaded, stored, or sent anywhere — the app does no networking at all.

## Licence

MIT — see [LICENSE](LICENSE).
