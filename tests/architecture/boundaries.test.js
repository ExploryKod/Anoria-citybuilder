/**
 * Architecture boundary guard (plan_ca Barre F).
 *
 * Enforces dependency rules after strangler removal:
 * - no src/js/ package
 * - composition / ui / presentation must not import legacy js/
 * - ui / presentation must not import contexts domain layers (use facades or application)
 * - domain must not import infrastructure; contexts must not import js; engine must not import contexts/js
 */

import fs from 'fs';
import path from 'path';
import { describe, test, expect } from '@jest/globals';

const SRC_ROOT = path.resolve('src');

/** @type {Set<string>} `${relativeFile}::${importSpec}` */
const ALLOWLIST = new Set([]);

const IMPORT_FROM_RE = /\bfrom\s+['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Remove block/line comments so JSDoc type imports are not treated as runtime imports. */
function stripComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

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

function isLegacyJsImport(importSpec) {
  return (
    importSpec.includes('/js/')
    || importSpec.includes('../js/')
    || /(^|\/)js\/acl\//.test(importSpec)
    || /(^|\/)js\/utils\//.test(importSpec)
  );
}

function isContextsDomainImport(importSpec) {
  return /contexts\/[^/]+\/domain\//.test(importSpec);
}

function checkViolation(fileRel, importSpec) {
  if (isAllowlisted(fileRel, importSpec)) {
    return null;
  }

  const isContextsImport = importSpec.includes('contexts/');
  const isInfraImport =
    importSpec.includes('/infrastructure/') || importSpec.includes('../infrastructure/');

  if (fileRel.startsWith('contexts/') && isContextsImport) {
    const fromContext = fileRel.split('/')[1];
    const toContext = importSpec.match(/contexts\/([^/]+)/)?.[1];
    if (toContext && fromContext !== toContext) {
      return 'cross-context import';
    }
  }

  if (fileRel.includes('/domain/') && isLegacyJsImport(importSpec)) {
    return 'domain must not import legacy js/';
  }

  if (fileRel.includes('/domain/') && isInfraImport) {
    return 'domain must not import infrastructure';
  }

  if (fileRel.includes('/application/') && isLegacyJsImport(importSpec)) {
    return 'application must not import legacy js/';
  }

  if (fileRel.startsWith('contexts/') && isLegacyJsImport(importSpec)) {
    return 'contexts/ must not import legacy js/';
  }

  if (fileRel.startsWith('composition/') && isLegacyJsImport(importSpec)) {
    return 'composition/ must not import legacy js/';
  }

  // src/presentation/{dom,three} — not contexts/*/infrastructure/presentation
  if (
    fileRel.startsWith('composition/')
    && /(^|\/)presentation\/(dom|three)\//.test(importSpec)
  ) {
    return 'composition must not import presentation (inject callbacks / ports at the edge)';
  }

  if (fileRel.startsWith('contexts/') && /(^|\/)composition\//.test(importSpec)) {
    return 'contexts must not import composition (inject collaborators from the root)';
  }

  if (fileRel.startsWith('presentation/') && isLegacyJsImport(importSpec)) {
    return 'presentation must not import legacy js/';
  }

  if (fileRel.startsWith('presentation/') && isContextsDomainImport(importSpec)) {
    return 'presentation must not import contexts/*/domain (use sessionApi / composition ops or application)';
  }

  if (fileRel.startsWith('engine/') && (isContextsImport || isLegacyJsImport(importSpec))) {
    return 'engine/ must not depend on contexts/ or js/';
  }

  return null;
}

describe('architecture boundaries', () => {
  test('src/js/ package is gone', () => {
    const jsRoot = path.join(SRC_ROOT, 'js');
    expect(fs.existsSync(jsRoot)).toBe(false);
  });

  test('src/ui/ package is gone (migrated to presentation/dom)', () => {
    const uiRoot = path.join(SRC_ROOT, 'ui');
    expect(fs.existsSync(uiRoot)).toBe(false);
  });

  test('composition/facades/ package is gone (sessionApi + *Ops)', () => {
    const facadesRoot = path.join(SRC_ROOT, 'composition', 'facades');
    expect(fs.existsSync(facadesRoot)).toBe(false);
  });

  test('presentation must not import *Ops or getOrCreate*Context (except game session)', () => {
    const presentationRoot = path.join(SRC_ROOT, 'presentation');
    const files = listJsFiles(presentationRoot);
    const violations = [];
    for (const absolutePath of files) {
      const fileRel = toSrcRelative(absolutePath);
      const content = stripComments(fs.readFileSync(absolutePath, 'utf8'));
      for (const re of [IMPORT_FROM_RE, DYNAMIC_IMPORT_RE]) {
        re.lastIndex = 0;
        for (const match of content.matchAll(re)) {
          const importSpec = match[1];
          if (/composition\/facades\//.test(importSpec) || /\/facades\//.test(importSpec)) {
            violations.push(`${fileRel} imports "${importSpec}" — presentation must not import facades`);
          }
          if (/(^|\/)composition\/\w*Ops\.js$/.test(importSpec)) {
            violations.push(`${fileRel} imports "${importSpec}" — presentation must use sessionApi, not *Ops`);
          }
        }
      }
      if (/getOrCreate(?!GameSession)\w*Context/.test(content)) {
        violations.push(`${fileRel} calls getOrCreate*Context — use sessionApi / injected deps`);
      }
    }
    expect(violations).toEqual([]);
  });

  test('import graph respects layer rules', () => {
    const files = listJsFiles(SRC_ROOT);
    const violations = [];

    for (const absolutePath of files) {
      const fileRel = toSrcRelative(absolutePath);
      const content = stripComments(fs.readFileSync(absolutePath, 'utf8'));

      for (const re of [IMPORT_FROM_RE, DYNAMIC_IMPORT_RE]) {
        re.lastIndex = 0;
        for (const match of content.matchAll(re)) {
          const importSpec = match[1];
          const reason = checkViolation(fileRel, importSpec);
          if (reason) {
            violations.push(`${fileRel} imports "${importSpec}" — ${reason}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test('allowlist is empty (no known boundary debt)', () => {
    expect(ALLOWLIST.size).toBe(0);
  });

});
