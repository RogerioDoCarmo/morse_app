import appJson from '../app.json';

/**
 * The version this build claims, read from the file that declares it.
 *
 * Imported rather than typed out so the two can never disagree: `app.json` is
 * what EAS builds from, what `release.yml` checks a tag against, and now what
 * Settings shows. A constant copied by hand would be a third declaration of
 * the same fact and the first one to go stale.
 *
 * ⚠️ The BUILD number is deliberately not here. It lives on EAS
 * (`appVersionSource: "remote"`), so it is not in `app.json` at all and there
 * is nothing to read — see COMMANDS.md. Showing it would take a native module.
 */
export const APP_VERSION: string = appJson.expo.version;
