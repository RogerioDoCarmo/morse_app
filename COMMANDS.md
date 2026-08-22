# Commands

Quick reference. Everything assumes **pnpm** — CI, EAS and every script depend on it.

## Daily

| Command | Does |
| --- | --- |
| `pnpm start` | Metro dev server |
| `pnpm ios` / `pnpm android` | Build and run on a simulator/emulator |
| `pnpm run:ios` / `pnpm run:android` | Same, on a connected device |
| `pnpm web` | Run in a browser (react-native-web) |

## Quality gates

| Command | Does |
| --- | --- |
| `pnpm typecheck` | `tsc --noEmit`, strict + `noUncheckedIndexedAccess` |
| `pnpm lint` | ESLint 9 flat config |
| `pnpm lint:fix` | …and fix what it can |
| `pnpm lint:md` | markdownlint over every `.md` |
| `pnpm format` / `pnpm format:check` | Prettier (markdown excluded — markdownlint owns it) |
| `pnpm test` | Jest |
| `pnpm test:watch` | Jest in watch mode |
| `pnpm test:coverage` | Jest with the 80% thresholds enforced |
| `pnpm mutation` | Stryker over `src/core/**` — break threshold 60 |
| `pnpm test:e2e` | Maestro flows against a running device |

Scoped mutation run while working on one file:

```bash
pnpm exec stryker run --mutate "src/core/domain/morse.ts"
```

## Builds

| Command | Does |
| --- | --- |
| `pnpm build:apk` | EAS preview APK — installable |
| `pnpm build:aab` | EAS production AAB — **not** installable, store upload only |
| `pnpm build:ipa` | EAS production IPA |
| `pnpm build:apk:local` etc. | The same, built on this machine |

## Verifying the shipped permission surface

Always check the **built artifact**, never the manifest source, and never via `strings`:

```bash
aapt2 dump permissions app-release.apk
```

```bash
bundletool dump manifest --bundle=app.aab
```

```bash
unzip -p app.ipa "Payload/*.app/Info.plist" | plutil -p -
```

Expected in release: `CAMERA` (torch) and `RECORD_AUDIO` (speech) — nothing else.
`DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` also appears; that is androidx declaring a
signature-level permission for its own receivers. It is not user-facing and **must not**
be stripped.

## Git

Git Flow, strictly. `feature/*` branches from `develop`; `develop` reaches `main` only
by PR. Never commit directly to `develop` or `main`, and never `git rebase`.
