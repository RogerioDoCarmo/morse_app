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

1. **Have the repository up to date on `main`.** Everything below assumes the
   version is `0.3.6`.
2. ⚠️ **Copy `GoogleService-Info.plist` onto a USB stick or AirDrop it.** It is
   **not in git** — `.gitignore:75` excludes it, deliberately, because it is a
   credential. `git pull` on the Mac will **not** bring it, and its absence does
   not announce itself as a missing file: the build fails with
   `Could not get GOOGLE_APP_ID in Google Services file from build environment`,
   which reads like a signing error.
3. **Decide the build number.** See step 5 — it is `17` unless something has
   been uploaded since.

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
already uploaded **for this version string**. The last iOS build uploaded was
**0.3.5 (16)**, so use **17**.

⚠️ The target directory is named by `expo prebuild` from the app name and is
**not** verifiable from Windows, so find it rather than assuming `OmniMorse`:

```bash
PLIST=$(ls ios/*/Info.plist | head -1)
echo "$PLIST"
/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion 17"          "$PLIST"
/usr/libexec/PlistBuddy -c "Print :CFBundleVersion"           "$PLIST"
```

`CFBundleShortVersionString` should already read `0.3.6`. If it does not, stop —
`app.json` disagrees with what you are about to ship.

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

**Xcode → Settings → Accounts.** `rogerio.carmo02@gmail.com` must be listed and
selected. A different Apple ID was signed in on that Mac, and the team it
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

Name it so it says what it is, matching the convention the submit script
expects:

```text
omnimorse-0.3.6-17-appstore.ipa
```

---

## Submitting

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

- `eas submit --platform ios --path ./omnimorse-0.3.6-17-appstore.ipa`
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
