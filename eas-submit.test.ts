// `eas submit` reads eas.json and does what it says without asking twice. The
// two values below decide where a release lands and where its credential comes
// from, and neither failure is visible until it has already happened.
import * as fs from 'fs';
import * as path from 'path';

const easJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'eas.json'), 'utf8')) as {
  submit?: {
    production?: {
      android?: {
        track?: string;
        releaseStatus?: string;
        serviceAccountKeyPath?: string;
      };
      ios?: { ascAppId?: string };
    };
  };
};

const android = easJson.submit?.production?.android;
const GITIGNORE = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf8');

describe('eas submit — android', () => {
  it('has a production submit profile at all', () => {
    expect(android).toBeDefined();
  });

  /**
   * ⚠️ `internal`, and the default in most examples is `production`.
   *
   * A submit profile that can reach production is one typo and one habit away
   * from using it, and `eas submit` does not pause to confirm. It changes when
   * there is a production release to make, not before.
   */
  it('submits to the internal track', () => {
    expect(android?.track).toBe('internal');
  });

  it('completes the release rather than leaving it a draft', () => {
    expect(android?.releaseStatus).toBe('completed');
  });

  /**
   * ⚠️ THIS REPOSITORY IS PUBLIC, and the key has upload rights to the store
   * listing. The path must leave the repository — a relative path climbing out
   * of it, or an absolute one.
   */
  it('keeps the service account key outside the repository', () => {
    const keyPath = android?.serviceAccountKeyPath;
    expect(keyPath).toBeDefined();
    const escapes = (keyPath as string).startsWith('../');
    const absolute = path.isAbsolute(keyPath as string);
    expect(escapes || absolute).toBe(true);
  });

  /**
   * And the safety net underneath it. `*.key` and `*.p8` were already ignored;
   * neither matches a `.json`, so nothing here would have caught a Play
   * service account key dropped into the working tree.
   */
  it.each(['*service-account*.json', 'play-store-credentials.json'])(
    'ignores %s, so a key in the tree cannot be committed by accident',
    (pattern) => {
      expect(GITIGNORE).toContain(pattern);
    },
  );
});
