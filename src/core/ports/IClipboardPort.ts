/**
 * Puts text on the system clipboard.
 *
 * ⚠️ Write-only, deliberately. Reading the clipboard is a privacy-sensitive
 * act — iOS shows the user a banner every time an app does it — and nothing
 * here needs to. The app copies Morse OUT; it never wants to know what else
 * you have copied.
 */
export interface IClipboardPort {
  /**
   * Copies `text`, resolving `true` when the platform accepted it.
   *
   * `false` is a real answer rather than a thrown error: a platform can refuse
   * without explanation, and the caller's only sensible response either way is
   * to tell the user what happened rather than to retry.
   */
  write(text: string): Promise<boolean>;
}
