// Google Play refused the 0.3.11 (19) closed-test release because a portrait
// orientation lock (expo-camera's ML Kit scanner activity) makes Android imply a
// REQUIRED android.hardware.screen.portrait feature. The CAMERA and RECORD_AUDIO
// permissions imply camera and microphone the same way. This plugin declares all
// three optional; the tests pin the exact manifest output, with literal values on
// purpose.
import withOptionalHardwareFeatures, {
  OPTIONAL_FEATURES,
  setFeaturesOptional,
} from './withOptionalHardwareFeatures';

jest.mock('expo/config-plugins', () => ({
  // Run the mod immediately instead of queueing it for a prebuild.
  withAndroidManifest: (config: object, action: (cfg: object) => object) =>
    action(config),
}));

interface UsesFeature {
  $: Record<string, string>;
}
interface Manifest {
  'uses-feature'?: UsesFeature[];
  application?: object[];
}

const feature = (name: string, required: string): UsesFeature => ({
  $: { 'android:name': name, 'android:required': required },
});
const portrait = (required: string) =>
  feature('android.hardware.screen.portrait', required);
const camera = (required: string) => feature('android.hardware.camera', required);
const microphone = (required: string) => feature('android.hardware.microphone', required);
const wifi: UsesFeature = {
  $: { 'android:name': 'android.hardware.wifi', 'android:required': 'true' },
};

describe('OPTIONAL_FEATURES', () => {
  it('names exactly the three features aapt2 reported as implied-required', () => {
    expect(OPTIONAL_FEATURES).toEqual([
      'android.hardware.screen.portrait',
      'android.hardware.camera',
      'android.hardware.microphone',
    ]);
  });
});

describe('setFeaturesOptional', () => {
  it('adds all three as optional when the manifest declares none', () => {
    const manifest: Manifest = {};

    setFeaturesOptional(manifest);

    expect(manifest['uses-feature']).toEqual([
      {
        $: {
          'android:name': 'android.hardware.screen.portrait',
          'android:required': 'false',
        },
      },
      { $: { 'android:name': 'android.hardware.camera', 'android:required': 'false' } },
      {
        $: { 'android:name': 'android.hardware.microphone', 'android:required': 'false' },
      },
    ]);
  });

  it('flips existing required entries to optional in place', () => {
    const manifest: Manifest = { 'uses-feature': [camera('true'), portrait('true')] };

    setFeaturesOptional(manifest);

    expect(manifest['uses-feature']).toEqual([
      camera('false'),
      portrait('false'),
      microphone('false'),
    ]);
  });

  it('flips an entry that has no required attribute at all', () => {
    const manifest: Manifest = {
      'uses-feature': [{ $: { 'android:name': 'android.hardware.microphone' } }],
    };

    setFeaturesOptional(manifest);

    expect(manifest['uses-feature']).toEqual([
      microphone('false'),
      portrait('false'),
      camera('false'),
    ]);
  });

  it('does not duplicate entries when run a second time', () => {
    const manifest: Manifest = {};

    setFeaturesOptional(manifest);
    setFeaturesOptional(manifest);

    expect(manifest['uses-feature']).toEqual([
      portrait('false'),
      camera('false'),
      microphone('false'),
    ]);
  });

  it('leaves other uses-feature entries untouched and appends after them', () => {
    const manifest: Manifest = { 'uses-feature': [wifi] };

    setFeaturesOptional(manifest);

    expect(manifest['uses-feature']).toEqual([
      wifi,
      portrait('false'),
      camera('false'),
      microphone('false'),
    ]);
    expect(wifi.$['android:required']).toBe('true');
  });

  it('marks every duplicate entry optional', () => {
    const manifest: Manifest = { 'uses-feature': [portrait('true'), portrait('true')] };

    setFeaturesOptional(manifest);

    expect(manifest['uses-feature']).toEqual([
      portrait('false'),
      portrait('false'),
      camera('false'),
      microphone('false'),
    ]);
  });

  it('does not touch the rest of the manifest', () => {
    const application = [{ $: { 'android:name': '.MainApplication' } }];
    const manifest: Manifest = { application };

    setFeaturesOptional(manifest);

    expect(manifest.application).toBe(application);
  });

  it('returns the manifest it was given', () => {
    const manifest: Manifest = {};

    expect(setFeaturesOptional(manifest)).toBe(manifest);
  });
});

describe('withOptionalHardwareFeatures', () => {
  it('applies the change to the Android manifest and returns the config', () => {
    const manifest: Manifest = { 'uses-feature': [portrait('true')] };
    const config = { modResults: { manifest } };

    const result = withOptionalHardwareFeatures(config);

    expect(result).toBe(config);
    expect(manifest['uses-feature']).toEqual([
      portrait('false'),
      camera('false'),
      microphone('false'),
    ]);
  });
});
