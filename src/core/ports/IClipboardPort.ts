/**
 * Puts text on the system clipboard.
 *
 * ⚠️ Reading is privacy-sensitive and stays USER-INITIATED.
 *
 * This was write-only, on the reasoning that "nothing here needs to read".
 * A Paste button needs to, so the reasoning is replaced rather than quietly
 * contradicted: iOS shows the user a prompt or a banner whenever an app reads
 * the pasteboard, and that is correct behaviour. The rule is that `read` is
 * only ever called because someone pressed Paste — never on mount, never to
 * offer a suggestion, never to see what is there.
 */
export interface IClipboardPort {
  /**
   * Reads the clipboard's text, or `null` when there is none to read.
   *
   * `null` covers an empty clipboard, one holding something that is not text,
   * and a platform that refused — all of which mean the same thing to the
   * caller: there is nothing to paste.
   */
  read(): Promise<string | null>;
  /**
   * Copies `text`, resolving `true` when the platform accepted it.
   *
   * `false` is a real answer rather than a thrown error: a platform can refuse
   * without explanation, and the caller's only sensible response either way is
   * to tell the user what happened rather than to retry.
   */
  write(text: string): Promise<boolean>;
}
