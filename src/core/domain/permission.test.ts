import { canPrompt, isBlocked, type PermissionState } from './permission';

describe('permission state', () => {
  const loading: PermissionState = null;
  const granted: PermissionState = { granted: true, canAskAgain: false };
  const askable: PermissionState = { granted: false, canAskAgain: true };
  const blocked: PermissionState = { granted: false, canAskAgain: false };

  it.each([
    ['loading', loading, false, false],
    ['granted', granted, false, false],
    ['deniable', askable, true, false],
    ['blocked', blocked, false, true],
  ])('classifies %s', (_label, state, prompt, settings) => {
    expect(canPrompt(state)).toBe(prompt);
    expect(isBlocked(state)).toBe(settings);
  });

  it('never treats an unknown state as actionable', () => {
    expect(canPrompt(null)).toBe(false);
    expect(isBlocked(null)).toBe(false);
  });
});
