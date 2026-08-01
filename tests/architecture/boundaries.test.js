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

  if (fileRel.startsWith('presentation/') && isLegacyJsImport(importSpec)) {
    return 'presentation must not import legacy js/';
  }

  if (fileRel.startsWith('presentation/') && isContextsDomainImport(importSpec)) {
    return 'presentation must not import contexts/*/domain (use composition/facades or application)';
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

  test('commerce BC does not read UI goodsData via presenter/registry', () => {
    const commerceRoot = path.join(SRC_ROOT, 'contexts', 'commerce');
    const files = listJsFiles(commerceRoot);
    const violations = [];

    const forbidden = [
      /getCommerceSectionPresenter\s*\(/,
      /commerceSectionPresenter/,
      /commerceSectionManager/,
      /from\s+['"][^'"]*\/presentation\/dom\//,
      /\.goodsData\b/,
    ];

    for (const absolutePath of files) {
      const fileRel = toSrcRelative(absolutePath);
      const content = fs.readFileSync(absolutePath, 'utf8');

      if (/\w+\.goodsData\b/.test(content) && !/saveConfig\s*\(\s*goodsData/.test(content)) {
        const propertyReads = content.match(/\w+\.goodsData\b/g) || [];
        for (const hit of propertyReads) {
          if (hit === 'this.goodsData' || hit.includes('Presenter') || hit.includes('Manager')) {
            violations.push(`${fileRel} accesses "${hit}"`);
          }
        }
      }

      for (const pattern of forbidden.slice(0, 4)) {
        if (pattern.test(content)) {
          violations.push(`${fileRel} matches ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
