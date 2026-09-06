# TestFlight — what to paste into App Store Connect

Copy this into **TestFlight → Test Information** and **Beta App Review
Information**. Kept here so the next release does not start from a blank box.

---

## Beta App Description

Morse turns text into Morse code and Morse code back into text.

Type a message and watch it become dots and dashes letter by letter, or tap it
in on a key that measures how long you hold it. A message can go out four ways —
as sound, as the camera flash, as a flashing screen, or as vibration — and you
can switch any of them on or off, even while a message is playing.

There is also a Learn tab with the full alphabet, the timing rules, and how to
actually memorise it.

The whole interface is in English, Brazilian Portuguese and Spanish.

## What to Test

Everything works without granting any permission, so start there and grant only
what you want to try.

**Worth the most attention** — these three have never run on real hardware, only
on simulators that have no camera, no haptics and no microphone:

1. **Light** — switch on the Light output and press Emit. The torch should blink
   the message. A dot is about a tenth of a second, so it is quick. Does it look
   like Morse, or does it smear?
2. **Vibrate** — switch on Vibrate and press Emit. iOS cannot vary how long a
   vibration lasts, so each mark is a pulse and the strength is what separates a
   dot from a dash. Can you actually tell them apart?
3. **Speak** — the Speak tab, then the microphone. Does it hear you correctly in
   your language?

**Also useful:**

- **Tap** — hold the key for a dash, tap it for a dot. If your dashes come out
  as dots, the cut-off is wrong for your speed: change it there or in Settings.
- **Screen** — switch on Screen and press Emit. The disc flashes the message.
  Tell us if it is uncomfortable to look at.
- **Language** — switch between English, Português and Español in Settings. The
  whole interface should change, and your choice should survive a restart.
- **On an iPad** — the app should use a side rail instead of a bottom bar, and
  put things side by side.

**Things to tell us:**

- Anything that reads oddly in your language
- Anything that looks wrong on your device size
- Whether the settings you change are still there after a restart

## Feedback Email

<contact@rogeriodocarmo.com>

## Privacy Policy URL

<https://rogeriodocarmo.github.io/morse_app/privacy-policy.html>

_Served by GitHub Pages from `docs/`, the same way Miroji publishes its own —
`main` branch, `/docs` folder, in the repository's Pages settings._

_Not required to submit for external Beta App Review, which asked only for a
contact name, email, phone and What to Test. It IS required for App Store
submission, and worth having regardless: the app sends crash diagnostics._

## Beta App Review Information

- **Sign-in required:** No. There is no account of any kind.
- **Notes for the reviewer:**

  > Morse needs no login and no network connection to work.
  >
  > The camera permission is used only to switch the torch on and off so a
  > message can be played as light — the camera preview is never opened and no
  > image is captured. The microphone permission is used only on the Speak tab
  > to turn speech into text.
  >
  > Both permissions are optional and every other feature works without them.

## App Privacy (nutrition label)

Declare **Diagnostics → Crash Data**, _not_ linked to the user and _not_ used
for tracking. That matches `ios.privacyManifests` in `app.json` and the Crashlytics
opt-out in Settings.

Nothing else is collected.
