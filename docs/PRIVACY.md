# Privacy Policy — Morse

Last updated: 6 September 2026.

Morse is a Morse code translator. It has no accounts, no advertising, no
analytics, and no way to identify you.

This policy describes every piece of data the app handles and everywhere it can
go. Where something leaves your device, it says so plainly.

## What stays on your device

**Your settings.** The dot/dash cut-off, playback speed, interface language,
speech-recognition language, and whether decoded text is read aloud. Also a note
of whether you have seen the welcome guide.

These are stored in the app's own storage on your device. They are never sent
anywhere, and they are deleted when you uninstall the app.

**Your messages.** Anything you type, tap in, or speak is translated on your
device and held only while the app is open. Nothing you write is stored between
sessions, and nothing you write is transmitted.

## What can leave your device

### Crash reports — and how to turn them off

When the app crashes, a diagnostic report is sent to Firebase Crashlytics, a
service operated by Google. A report contains the state of the app at the moment
it failed: the type of error, where in the code it happened, your device model
and operating system version, and an app-generated installation identifier.

**It does not contain anything you typed, tapped, or said.**

You can turn this off at any time in **Settings → Privacy → Send crash
reports**. The switch takes effect immediately and is remembered.

Google's handling of that data is covered by the
[Firebase privacy documentation](https://firebase.google.com/support/privacy).

### Speech recognition

If you use the Speak tab, the app asks your device's own speech-recognition
service to turn what you say into text.

**On iOS this may mean your audio is sent to Apple for processing.** Apple
decides whether recognition happens on the device or on its servers, based on
your device, the language, and system settings. Morse does not currently require
on-device recognition, so audio may leave your device during recognition.

**On Android, recognition is handled by the speech service installed on your
device**, which is usually Google's.

Morse itself never records, stores, or transmits audio. It receives only the
resulting text, holds it in memory, and discards it when you leave the screen.
Apple's and Google's handling of that audio is covered by their own privacy
policies.

### Checking for updates

The app checks for over-the-air updates when it starts. That request goes to
Expo's update service and carries the app version, platform, and an
installation identifier. It carries nothing about you or your messages.

## What the app asks permission for, and why

**Camera** — used only to switch the torch on and off, so a message can be
played as light. The camera preview is never opened and no image is ever
captured. Morse cannot read your photo library; the photo-library entry required
by iOS exists only because the camera component the app uses references it.

**Microphone and speech recognition** — used only while you are on the Speak tab
with recording active, to turn speech into text as described above.

Both permissions are optional. Everything else in the app — typing, tapping,
sound, screen flashing, vibration, and the whole of Learn — works without
granting either.

## Children

Morse does not knowingly collect any personal information from anyone, including
children. There is no account, no profile, and no way to submit content to us.

## Changes to this policy

If the app starts handling data differently, this document changes in the same
release, in the same repository, with the change visible in its history.

## Contact

Questions about this policy: <contact@rogeriodocarmo.com>

Source code: <https://github.com/RogerioDoCarmo/morse_app>
