// The plugin is CommonJS, loaded by Expo the same way.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('./withoutUpdatesMetadata.js') as {
  PREFIX: string;
  stripUpdatesMetadata: (manifest: Manifest) => Manifest;
};

type Manifest = { application?: { 'meta-data'?: { $: Record<string, string> }[] }[] };

const meta = (name: string, value = 'x') => ({
  $: { 'android:name': name, 'android:value': value },
});

describe('withoutUpdatesMetadata', () => {
  it('matches the expo-updates keys and nothing broader', () => {
    expect(plugin.PREFIX).toBe('expo.modules.updates.');
  });

  /** What `expo prebuild` wrote for the F-Droid variant, verbatim, plus a neighbour. */
  it('removes the four entries prebuild writes, and keeps everything else', () => {
    const manifest: Manifest = {
      application: [
        {
          'meta-data': [
            meta('expo.modules.updates.ENABLED', 'false'),
            meta('expo.modules.updates.ENABLE_BSDIFF_PATCH_SUPPORT', 'true'),
            meta('expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH', 'ALWAYS'),
            meta('expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS', '0'),
            meta('expo.modules.updates_not_this_one'),
            meta('com.example.keep'),
          ],
        },
      ],
    };

    expect(
      plugin.stripUpdatesMetadata(manifest).application?.[0]?.['meta-data'],
    ).toStrictEqual([
      meta('expo.modules.updates_not_this_one'),
      meta('com.example.keep'),
    ]);
  });

  it('copes with a manifest that has no application or no meta-data', () => {
    expect(plugin.stripUpdatesMetadata({})).toStrictEqual({});
    expect(plugin.stripUpdatesMetadata({ application: [{}] })).toStrictEqual({
      application: [{}],
    });
  });
});
