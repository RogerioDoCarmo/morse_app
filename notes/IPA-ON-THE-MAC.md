# Building the IPA on the Mac, by hand

Ordered checklist for producing an App Store IPA in Xcode, on a Mac that can
run **neither EAS nor an AI agent**. Read it there; it exists in the repository
for exactly that reason.

> ⚠️ **Nothing here uses EAS.** Not `eas build`, not `eas credentials`, not
> `eas submit`. Every `eas` script in `package.json` — `build:ipa`,
> `build:ipa:local` and the rest — is unavailable on that machine. This is the
> Xcode path instead.
>
> ⚠️ **The 1 October EAS credit reset does not gate this.** That date blocked
> the *EAS* build path. A local Xcode archive spends no credits, so the IPA can
> be built as soon as the Mac is in front of you.

---

## Before you leave the PC

1. ⚠️ **`git pull` ON THE MAC, and read the version back.** Everything below
   assumes **0.3.7**.

   ```bash
   git checkout main && git pull
   node -p "require('./app.json').expo.version"
   ```

   ⚠️ **This is the step that was skipped.** Build 17 was archived from a
   checkout that predated the 0.3.7 bump, so it went to App Store Connect as
   **0.3.6** — carrying the 5.1.1 fix, but none of the device-feedback work.
   Nothing in Xcode says which commit it built; the only place the mistake is
   visible is the version string, and by then the upload has happened.
2. ⚠️ **Copy `GoogleService-Info.plist` onto a USB stick or AirDrop it.** It is
   **not in git** — `.gitignore:75` excludes it, deliberately, because it is a
   credential. `git pull` on the Mac will **not** bring it, and its absence does
   not announce itself as a missing file: the build fails with
   `Could not get GOOGLE_APP_ID in Google Services file from build environment`,
   which reads like a signing error.
3. ⚠️ **Decide the build number — and it is no longer 18.** See step 5. **18 is
   uploaded and in App Store review**; anything built from now on is **19**.

---

## On the Mac

### 1. Get the code

```bash
git clone https://github.com/RogerioDoCarmo/morse_app.git   # or: git pull
cd morse_app
git checkout main
```

### 2. Install the toolchain and dependencies

```bash
corepack enable
pnpm install --frozen-lockfile
```

⚠️ Check the exit code, not the output — `pnpm install … | tail` would report
`tail`'s success. If it fails on a lockfile error, stop: that is a real problem
and not something to work around on this machine.

### 3. Put the credential in place

```bash
cp /Volumes/<stick>/GoogleService-Info.plist ./GoogleService-Info.plist
ls -l GoogleService-Info.plist
```

It goes in the **repository root**, beside `app.json`. `app.config.js` looks for
it there and silently builds *without* Firebase if it is missing — so a build
that succeeds is not proof the file was found.

### 4. Generate the native project

```bash
npx expo prebuild --platform ios --clean
```

This creates `ios/`, which is not in the repository. `--clean` matters: a stale
`ios/` from an earlier Expo version is worse than none.

### 5. Set the build number

Apple rejects an upload whose `CFBundleVersion` is not higher than every build
already uploaded **for this version string**. The last iOS build uploaded is
**0.3.7 (18)**, now *Waiting for Review*, so use **19**.

⚠️ **THIS SECTION SAID 18 UNTIL 12 OCTOBER 2026, AND THE REASON IT GAVE HAD
EXPIRED.** It read "the last iOS build uploaded was 0.3.6 (17), so use 18" —
true when written, false once 18 went up. ⚠️ A guide that hard-codes a number
goes stale silently, which is the same failure mode as the stale checkout that
sent build 17 to Apple labelled 0.3.6. **Read the number off the two places
that actually know it, rather than off this page:**

```bash
npx eas build:version:get --platform ios --non-interactive   # the remote counter
```

and App Store Connect for what has actually been uploaded.

⚠️ 17 and 18 are both taken. Apple refuses an upload whose `CFBundleVersion`
repeats one already seen for the same version string.

ⓘ **19 is also the tidy answer for an ad-hoc build that will never reach
Apple.** EAS's remote counter already reads 19 — incremented on 23 September
and then refused for credits, leaving a number with no binary behind it. Using
19 gives that orphan a body instead of minting a second gap.

⚠️ The target directory is named by `expo prebuild` from the app name and is
**not** verifiable from Windows, so find it rather than assuming `OmniMorse`:

```bash
PLIST=$(ls ios/*/Info.plist | head -1)
echo "$PLIST"
/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion 19"          "$PLIST"
/usr/libexec/PlistBuddy -c "Print :CFBundleVersion"           "$PLIST"
```

`CFBundleShortVersionString` should already read `0.3.7`. ⚠️ **If it does not,
STOP.** It means the pull in step 1 did not happen or did not land, and the
archive will be labelled with a version you are not shipping — which is exactly
how 0.3.6 (17) reached Apple.

> ⚠️ `eas.json` sets `"appVersionSource": "remote"`, meaning EAS normally keeps
> the build number on its servers and `app.json` carries none. That mechanism
> is not in play here, which is exactly why this has to be set by hand.

### 6. Open the workspace

```bash
open ios/*.xcworkspace
```

⚠️ The **`.xcworkspace`**, never the `.xcodeproj`. The project alone omits the
CocoaPods dependencies and fails at link time.

### 7. Signing

⚠️ **Check the Apple ID FIRST.** This step cost a round of confusing errors on
22 September, and "choose your Team" is the instruction that allowed it.

**Xcode → Settings → Accounts.** The Apple ID that owns the App Store
listing must be listed and selected. A different Apple ID was signed in on that Mac, and the team it
offered could not own the app.

Then, in the target's **Signing & Capabilities**:

- Tick **Automatically manage signing**
- Team: the **Apple Developer Program** team, **never `(Personal Team)`**
- Bundle identifier must read **`com.rogeriodocarmo.morse`**

#### ⚠️ If you see "Failed Registering Bundle Identifier"

> The app identifier "com.rogeriodocarmo.morse" cannot be registered to your
> development team because it is not available.
>
> No profiles for 'com.rogeriodocarmo.morse' were found.

This is a **team** problem, not a certificate problem. The identifier is not
unavailable in general — it is *already registered*, to the paid team behind
App Store Connect app `6805992452`. The selected team is simply not that team.

Two causes, in order of likelihood:

1. **The selected team is the free `(Personal Team)`.** Xcode lists one for any
   signed-in Apple ID. It cannot register an App Store identifier and cannot do
   App Store distribution at all.
2. **The signed-in Apple ID is the wrong one** — which is what it was.

Pick the developer-program team and the errors clear without changing anything
else: that team already owns the identifier, so Xcode downloads the existing
profile instead of trying to create one.

⚠️⚠️ **DO NOT CHANGE THE BUNDLE IDENTIFIER.** Xcode's own suggestion — *"Change
your bundle identifier to a unique string to try again"* — is the standard
advice and is **wrong here**. `com.rogeriodocarmo.morse` is the shipped app's
identity on both stores. Changing it produces a binary App Store Connect
rejects as belonging to no known app, and it no longer matches `app.json`.

⚠️ **The signing certificates live in EAS, not on this Mac.** Xcode will create
or download its own Apple Distribution certificate for the account. That is
expected and fine — Apple allows more than one — but it means the first archive
may prompt for your Apple ID and for keychain access.

### 8. Archive

1. Set the destination to **Any iOS Device (arm64)** — *not* a simulator.
   Archive is greyed out for a simulator destination.
2. **Product → Archive**
3. Wait. A cold build of this app is 10–25 minutes.

### 9. Export the IPA

In the Organizer window that opens:

1. **Distribute App**
2. **App Store Connect**
3. **Export** — this writes an IPA you can carry back.

⚠️ Choose **Export**, not **Upload**, if you intend to submit from the PC.
Upload sends it from the Mac and there is then nothing to carry.

Name it so it says what it is — app, version, build, **destination** — matching
the convention the submit script expects:

```text
omnimorse-0.3.7-19-firebase-adhoc.ipa   # ad-hoc, for device testing
omnimorse-0.3.7-19-appstore.ipa         # App Store distribution
```

⚠️ **The destination suffix is not decoration.** Two IPAs for the same build
that differ only in how they are signed are otherwise indistinguishable on
disk, and only one of them can be submitted. `pnpm submit:ios` defends itself
by reading the embedded profile rather than the filename — but nothing defends
*you* from uploading the wrong file to Firebase and wondering why it installs
nowhere.

---

## Sending it to Firebase App Distribution

⚠️ **This is where an ad-hoc IPA goes, and it is not the same as submitting.**
Nothing below touches App Store Connect.

```bash
firebase appdistribution:distribute omnimorse-0.3.7-19-firebase-adhoc.ipa   --app 1:528695608041:ios:b8944ef8ac0615ff4be678   --release-notes "0.3.7 (19) — ad-hoc build for device testing"   --groups testers
```

⚠️ **Omit `--groups` to upload without emailing anyone**, then add the group in
a second run when the build is worth their attention. The group holds **2
testers** — both his own devices — so nothing here reaches the Play
closed-track testers, who arrived through a different channel entirely.

⚠️ **An ad-hoc IPA installs only on devices registered in its provisioning
profile.** Firebase will accept and distribute a build that no tester can
actually install, and it reports that as success. If a device is new since the
profile was made, register it and re-export before blaming the upload.

---

## Submitting to App Store Connect

**If you still have the Mac:** this is one command and the simpler path.

```bash
pnpm submit:ios
```

It finds the newest `*.ipa`, refuses an ad-hoc build by reading the embedded
profile rather than trusting the filename, and uploads with `altool`. It needs
an **app-specific password** (appleid.apple.com → Sign-In and Security), not
your Apple ID password.

**From the Windows PC instead**, carrying the IPA back:

⚠️ `pnpm submit:ios` **will not work there** — it calls `altool`, which ships
with Xcode and exists only on macOS. Two routes that do:

- `eas submit --platform ios --path ./omnimorse-0.3.7-19-appstore.ipa`
  (the app is `ascAppId 6805992452` in `eas.json`). This uploads an existing
  binary rather than building one. ⚠️ Confirm it does not consume a build
  credit before relying on it close to the reset date.
- Apple's **Transporter** command-line tool, which Apple ships for Windows as
  well as macOS.

---

## What this does not cover

- **App Store Connect metadata** — see `docs/APP-STORE.md`. The rejected
  version has already been renamed to 0.3.6 and the screenshots and localised
  text are in.
- **The 5.1.2 dispute** and the App Privacy "Used for Tracking" checkbox. Both
  are console work, not build work, and neither needs this IPA.
