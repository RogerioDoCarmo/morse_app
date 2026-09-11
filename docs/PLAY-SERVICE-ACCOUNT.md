# The Play service account

What `eas submit --platform android` needs and does not yet have. Until it
exists, every Android release is uploaded by hand through the Play Console.

[MACHINE-SETUP.md](MACHINE-SETUP.md) records it in the credentials table as
**not created yet**; this is how to change that.

---

## ⚠️ It will not help with the 0.3.0 rollout

**Google's Play Developer API cannot create an app's first release.** Until at
least one bundle has been uploaded through the Console by hand, API calls
against the app fail — so `morse-0.3.0-6.aab` goes up manually whatever else
happens. This is for the releases after it.

Worth knowing before spending an hour on setup expecting it to save the
afternoon.

---

## What it is, and where it lives

A **Google Cloud service account** — an identity that is not a person — which
Play Console is then told to trust for this developer account. It authenticates
as itself with a JSON key, so nothing has to hold your password.

⚠️ **The JSON key is a credential with upload rights to your store listing,
and this repository is PUBLIC.** It must never be committed. `.gitignore` now
carries a pattern for it, which is a safety net rather than a plan: keep the
file outside the repository entirely, the way the Firebase service account
already is.

---

## Setting it up

The Play Console's navigation for this has moved more than once, and looking
for it under the wrong heading is the usual way to lose twenty minutes. It is
an **account-level** setting, not a per-app one, and it needs account owner
rights.

| | |
| --- | --- |
| 1 | Play Console → **Setup → API access**. If the account has no Google Cloud project linked, it offers to create one — accept |
| 2 | Follow the link into **Google Cloud Console → IAM & Admin → Service accounts → Create service account**. Give it a name; **grant it no GCP roles** — its permissions come from Play, not from Google Cloud |
| 3 | On the new account: **Keys → Add key → Create new key → JSON** |
| 4 | Back in Play Console → API access → **Refresh service accounts**, then **Grant access** on the one you just made |
| 5 | Scope it to **this app only**, and give it *View app information* plus *Release apps to testing tracks*. Nothing else |
| 6 | **Apply / Invite user** |

⚠️ **The JSON downloads exactly once and cannot be re-downloaded.** Losing it
means deleting the key and making another. Put it somewhere backed up before
doing anything else with it.

⚠️ **Production release rights are a separate box, and leaving it unticked is
the right default.** A token that can only reach testing tracks cannot publish
to the world by accident — and `eas submit` is perfectly happy scoped that way
until there is a production release to make.

⚠️ **Granted permissions can take hours to propagate.** A `403` immediately
after granting access usually means "not yet", not "wrong". Wait before
re-cutting keys.

---

## Wiring it to EAS

Two ways, and the second matches how everything else here already works.

### Stored on EAS, like the keystore

```bash
eas credentials
#  → Android → production → Google Service Account → set up a new key
```

The Android keystore, the iOS certificates and the App Store Connect API key
are all fetched from EAS per build rather than kept on this machine — see the
credentials table in [MACHINE-SETUP.md](MACHINE-SETUP.md). A service account
held the same way needs no local file, survives this Mac, and works from CI.

### A local file

`eas.json` now carries the Android submit block, pointing outside the
repository:

```json
"android": {
  "serviceAccountKeyPath": "../play-service-account.json",
  "track": "internal",
  "releaseStatus": "completed"
}
```

⚠️ **`track: internal`, deliberately.** The same reasoning as the permissions
above: the default in many examples is `production`, and a submit profile that
can reach production is one typo away from using it. Change it when there is a
production release, not before.

---

## Using it

```bash
eas submit --platform android --profile production --path morse-0.3.0-6.aab
```

⚠️ **`eas submit` costs no build credits.** It is free and unaffected by the
credit pool that ran out on 9 September — there has never been a reason to
rebuild in order to submit, and there is none here either.

`--path` matters when the bundle was built with `--local`: without it, EAS
looks for a build on its own servers rather than the file in front of you.

---

## Checking it works

```bash
# Does the account authenticate and can it see the app at all?
eas submit --platform android --profile production --path morse-0.3.0-6.aab --non-interactive
```

| Failure | Usually means |
| --- | --- |
| `403` right after setup | permissions still propagating — wait, do not re-cut the key |
| `The caller does not have permission` | access granted at account level but not to **this app** |
| `Package not found` | the app has no manual first release yet (see the top of this file) |
| `Version code 6 has already been used` | the bundle was already uploaded by hand; bump and rebuild |
