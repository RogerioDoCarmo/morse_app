import { BUILD_VARIANT as STORE } from './buildVariant';
import { BUILD_VARIANT as FDROID } from './buildVariant.fdroid';

describe('the two bundled variants', () => {
  // Each file names its own build. Swapped, the F-Droid bundle would carry the
  // store app's switches — every feature on, Firebase adapter and all.
  it('names the store build in the default file', () => {
    expect(STORE).toBe('store');
  });

  it('names the F-Droid build in its twin', () => {
    expect(FDROID).toBe('fdroid');
  });
});
