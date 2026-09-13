import * as Application from 'expo-application';

import appJson from '../app.json';

/**
 * The version this build claims, read from the file that declares it.
 *
 * Imported rather than typed out so the two can never disagree: `app.json` is
 * what EAS builds from, what `release.yml` checks a tag against, and now what
 * Settings shows. A constant copied by hand would be a third declaration of
 * the same fact and the first one to go stale.
 *
 * ⚠️ The BUILD number is not in this file and cannot be. It lives on EAS
 * (`appVersionSource: "remote"`), so it is not in `app.json` at all — see
 * COMMANDS.md. It is read from the binary below instead.
 */
export const APP_VERSION: string = appJson.expo.version;

/**
 * The build number this binary actually carries — `CFBundleVersion` on iOS,
 * `versionCode` on Android.
 *
 * ⚠️ READ FROM THE BINARY, not from any file in this repository. EAS assigns
 * it at build time and nothing here knows it beforehand, which is precisely
 * why it has to come from the native side.
 *
 * Null off a real build — a Jest run has no native module to ask — so every
 * reader has to cope with its absence rather than print "undefined".
 */
export const APP_BUILD: string | null = Application.nativeBuildVersion;

/**
 * What Settings shows, and what a tester should quote: `0.3.4 (13)`.
 *
 * ⚠️ THE BUILD NUMBER IS THE HALF THAT IDENTIFIES THE BINARY. On 12 September
 * the Firebase testers had 0.3.4 (10) and TestFlight had 0.3.4 (13) — an hour
 * apart, from different commits, differing in real app behaviour. Both called
 * themselves 0.3.4, so "0.3.4 does X" could not be matched to code without
 * asking which build, and the version line on screen could not answer it.
 *
 * Falls back to the version alone when there is no native side to ask, rather
 * than showing an empty bracket.
 */
export const APP_VERSION_FULL: string =
  APP_BUILD === null ? APP_VERSION : `${APP_VERSION} (${APP_BUILD})`;
