# Morse

A Morse code translator for Android and iOS. Type or speak, watch it as dots and dashes,
play it on the torch — and tap it back in to decode.

> **Morse** is a placeholder wordmark, not the final app name.

## Status

Shipping to testers. Every screen in [design/](design/) is built, the suite runs nine
Maestro flows on both platforms, and 0.3.0 is on TestFlight and Firebase App
Distribution. Neither store listing is live yet.

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

Six, all genuinely used:

| Permission | Why |
| --- | --- |
| `CAMERA` | the torch. There is no separate torch permission on either platform |
| `RECORD_AUDIO` | speech input |
| `VIBRATE` | the Vibrate output channel |
| `MODIFY_AUDIO_SETTINGS` | the Sound output channel |
| `INTERNET` | crash reports, and the update check |
| `ACCESS_NETWORK_STATE` | Crashlytics stamps the network type on every report |

A release-only manifest source set strips everything else that bundled libraries inject.
The last two are the ones worth reading twice — see below.

## What leaves the device

⚠️ **Unlike [Miroji](https://github.com/RogerioDoCarmo/mirror_app), this app is not
offline-only.** Miroji can say nothing ever leaves the phone because nothing does. Two
things leave this one, and both are stated here rather than buried in the policy:

- **Crash reports**, through Firebase Crashlytics: a stack trace, the device model and
  OS version when the app fails. Never a message, never anything typed, spoken or
  keyed. **Switchable off** in Settings → Privacy, and off means off — the collector is
  swapped for a no-op.
- **An update check** on launch, to `u.expo.dev`. It asks whether a newer JavaScript
  bundle exists and downloads one if so.

Everything else — your messages, the decoded text, every preference — stays on the
device and is never uploaded. [PRIVACY.md](PRIVACY.md) says the same thing at length,
and the published policy is at
<https://rogeriodocarmo.github.io/morse_app/privacy-policy.html>.

## Licence

MIT — see [LICENSE](LICENSE).
