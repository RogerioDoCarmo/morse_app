/**
 * The element at `index`, or a failure that says which one was missing.
 *
 * ⚠️ For `getAllBy*` results under `noUncheckedIndexedAccess`, where indexing
 * yields `T | undefined` and the honest options are all worse: `as never`
 * throws the type away, a non-null assertion is banned by the lint config, and
 * passing the maybe-undefined straight to `fireEvent` fails to compile.
 *
 * It throws rather than returning undefined so a query that matched fewer
 * elements than the test assumed reports THAT, instead of surfacing three
 * frames later as a press on nothing.
 */
export function elementAt<T>(items: readonly T[], index = 0): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(
      `expected an element at index ${String(index)}, but only ${String(items.length)} matched`,
    );
  }
  return item;
}
