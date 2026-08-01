/**
 * Architecture boundary guard (Lot 1).
 *
 * Scans src/ imports and enforces dependency rules from src/archi.md §3.
 */

import fs from 'fs';
import path from 'path';
import { describe, test, expect } from '@jest/globals';

const SRC_ROOT = path.resolve('src');

/** @type {Set<string>} `${relativeFile}::${importSpec}` — empty once Lot 4 cleared js/ bypasses. */
const ALLOWLIST = new Set([]);

const IMPORT_FROM_RE = /\bfrom\s+['"]([^'"]+)['"]/g;

function listJsFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsFiles(absolute));
    } else if (entry.name.endsWith('.js')) {
      files.push(absolute);
    }
  }
  return files;
}

function toSrcRelative(absolutePath) {
  return path.relative(SRC_ROOT, absolutePath).split(path.sep).join('/');
}

function isAllowlisted(fileRel, importSpec) {
  return ALLOWLIST.has(`${fileRel}::${importSpec}`);
}

function checkViolation(fileRel, importSpec) {
  if (isAllowlisted(fileRel, importSpec)) {
    return null;
  }

  const isLegacyJsImport = importSpec.includes('/js/') || importSpec.includes('../js/');
  const isContextsImport = importSpec.includes('contexts/');
  const isInfraImport = importSpec.includes('/infrastructure/') || importSpec.includes('../infrastructure/');

  if (fileRel.startsWith('contexts/') && isContextsImport) {
    const fromContext = fileRel.split('/')[1];
    const toContext = importSpec.match(/contexts\/([^/]+)/)?.[1];
    if (toContext && fromContext !== toContext) {
      return 'cross-context import';
    }
  }

  if (fileRel.includes('/domain/') && isLegacyJsImport) {
    return 'domain must not import legacy js/';
  }

  if (fileRel.includes('/domain/') && isInfraImport) {
    return 'domain must not import infrastructure';
  }

  if (fileRel.includes('/application/') && isLegacyJsImport) {
    return 'application must not import legacy js/';
  }

  if (fileRel.startsWith('js/') && !fileRel.startsWith('js/acl/') && isContextsImport) {
    return 'js/ must reach contexts/ only via js/acl/';
  }

  if (fileRel.startsWith('engine/') && (isContextsImport || isLegacyJsImport)) {
    return 'engine/ must not depend on contexts/ or js/';
  }

  return null;
}

describe('architecture boundaries', () => {
  test('import graph respects layer rules', () => {
    const files = listJsFiles(SRC_ROOT);
    const violations = [];

    for (const absolutePath of files) {
      const fileRel = toSrcRelative(absolutePath);
      const content = fs.readFileSync(absolutePath, 'utf8');

      for (const match of content.matchAll(IMPORT_FROM_RE)) {
        const importSpec = match[1];
        const reason = checkViolation(fileRel, importSpec);
        if (reason) {
          violations.push(`${fileRel} imports "${importSpec}" — ${reason}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test('allowlist is empty (no known boundary debt)', () => {
    expect(ALLOWLIST.size).toBe(0);
  });
});
