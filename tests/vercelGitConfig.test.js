/**
 * Guard — Vercel must only deploy `main`.
 *
 * `git.deploymentEnabled` (vercel.json) maps minimatch branch patterns to a
 * boolean; any unlisted branch defaults to `true`, and a branch matching
 * several rules deploys as soon as ONE of them is `true`. So the safe shape is
 * exactly: `main` -> true, and a catch-all `**` -> false. (`*` alone would not
 * cover branches with a slash, e.g. `feature/x` or `dependabot/npm_and_yarn/y`.)
 */
import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const config = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8'));

describe('vercel.json — deploys only main', () => {
  const rules = config.git?.deploymentEnabled;

  test('main deploys, everything else (including branches with a slash) does not', () => {
    expect(typeof rules).toBe('object');
    expect(rules.main).toBe(true);
    expect(rules['**']).toBe(false);
  });

  test('no other rule can switch a non-main branch back on', () => {
    const enabled = Object.entries(rules).filter(([, on]) => on === true).map(([pattern]) => pattern);
    expect(enabled).toEqual(['main']);
  });
});
