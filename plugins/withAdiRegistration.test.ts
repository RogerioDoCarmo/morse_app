import { FILE, VARIABLE, tokenFromEnvironment } from './withAdiRegistration';

describe('the Play verification token', () => {
  it('is read from the environment rather than the repository', () => {
    expect(VARIABLE).toBe('ADI_REGISTRATION_TOKEN');
  });

  // Not `key=value`, despite the extension. Checked against Google's own
  // sample file, which is a bare token on one line.
  it('goes in the file Play Console asks for by name', () => {
    expect(FILE).toBe('adi-registration.properties');
  });

  it('takes the token when one is set', () => {
    expect(tokenFromEnvironment({ [VARIABLE]: 'DWKHFQ65ZWI62' })).toBe('DWKHFQ65ZWI62');
  });

  it('trims it, because a copied snippet brings whitespace with it', () => {
    expect(tokenFromEnvironment({ [VARIABLE]: '  DWKHFQ65ZWI62\n' })).toBe(
      'DWKHFQ65ZWI62',
    );
  });

  /**
   * The case that matters most. Every build that is NOT a verification build
   * must ship without the token — it identifies the developer account, and
   * this one goes to testers and to a store.
   */
  it.each([{}, { [VARIABLE]: '' }, { [VARIABLE]: '   ' }])(
    'says no token for %p, so ordinary builds ship without one',
    (environment) => {
      expect(tokenFromEnvironment(environment)).toBeNull();
    },
  );
});
