/**
 * Small values that outlive the app being closed.
 *
 * Deliberately string-in, string-out: the domain decides what a value means,
 * and a port that parsed JSON would be deciding for it.
 */
export interface IPreferencesPort {
  /** The stored value, or null when nothing has been stored under that key. */
  read(key: string): Promise<string | null>;
  /** Stores a value. Overwrites whatever was there. */
  write(key: string, value: string): Promise<void>;
}
