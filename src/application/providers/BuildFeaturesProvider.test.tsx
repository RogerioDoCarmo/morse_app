import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { featuresFor } from '@/core/domain/buildFeatures';
import {
  BUNDLED_FEATURES,
  BuildFeaturesProvider,
  useBuildFeatures,
} from './BuildFeaturesProvider';

function Probe(): React.JSX.Element {
  const features = useBuildFeatures();
  return (
    <Text testID="probe">
      {[features.crashReporting, features.otaUpdates, features.speechInput].join(',')}
    </Text>
  );
}

describe('BuildFeaturesProvider', () => {
  // Jest resolves `@/buildVariant` to the store file, as TypeScript and the
  // store bundle do. Only Metro, for the F-Droid build, sees the other one.
  it('bundles the store features by default', () => {
    expect(BUNDLED_FEATURES).toStrictEqual({
      crashReporting: true,
      otaUpdates: true,
      speechInput: true,
    });
  });

  it('answers with the bundled features outside any provider', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('true,true,true');
  });

  it('answers with the features it is given', () => {
    render(
      <BuildFeaturesProvider features={featuresFor('fdroid')}>
        <Probe />
      </BuildFeaturesProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('false,false,true');
  });
});
