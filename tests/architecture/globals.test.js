/**
 * Architecture guard — Lot 8 (D6 globals) + plan_ca Barre B/F.
 *
 * Direct window.service = assignments are forbidden outside AppRegistry.
 * Direct window.service reads must go through composition/facades/appRuntime.js
 * or composition/sessionRuntime.js.
 */

import fs from 'fs';
import path from 'path';
import { describe, test, expect } from '@jest/globals';

const SRC_ROOT = path.resolve('src');

/** Legacy globals being eliminated lot by lot. */
const FORBIDDEN_ASSIGNMENT_RES = [
  /window\.game\s*=/,
  /window\.gameUI\s*=/,
  /window\.popupManager\s*=/,
  /window\.tutorialManager\s*=/,
  /window\.buttonStateManager\s*=/,
  /window\.gameStore\s*=/,
  /window\.foodTraceabilityService\s*=/,
  /window\.budgetManager\s*=/,
  /window\.journalManager\s*=/,
  // Lot 8 phase 2
  /window\.objectivesTracker\s*=/,
  /window\.objectivesHistory\s*=/,
  /window\.objectivesStore\s*=/,
  /window\.workSectionPresenter\s*=/,
  /window\.multiplayerManager\s*=/,
  /window\.financesSectionPresenter\s*=/,
  /window\.storageSectionPresenter\s*=/,
  /window\.factorySectionPresenter\s*=/,
  /window\.reportSectionPresenter\s*=/,
  /window\.healthSectionPresenter\s*=/,
  /window\.commerceSectionPresenter\s*=/,
  /window\.parametersPanel\s*=/,
  /window\.EventBlocker\s*=/,
  /window\.setActiveTool\s*=/,
  /window\.processLoanPayments\s*=/,
  /window\.loadBudgetStates\s*=/,
  /window\.generateCarteVille\s*=/,
  /window\.refreshBudgetStatesModal\s*=/,
  /window\.startObjectives\s*=/,
  /window\.closeObjectives\s*=/,
  /window\.startTutorial\s*=/,
  /window\.closeTutorial\s*=/,
  /window\.openAdministratorPanel\s*=/,
  /window\.closeAdministratorPanel\s*=/,
  /window\.showAdministratorSection\s*=/,
  // Lot 8 phase 3
  /window\.TimeManager\s*=/,
  /window\.togglePerformanceStats\s*=/,
  /window\.toggleStatsJs\s*=/,
  /window\.webglTestMode\s*=/,
  /window\.testAnimation\s*=/,
  // Lot 8 phase 4
  /window\.inputManager\s*=/,
  /window\.updateBudgetDisplay\s*=/,
  /window\.scene\s*=/,
];

/** Direct reads of legacy service globals (use composition session/facades). */
const FORBIDDEN_READ_RES = [
  /window\.inputManager\b/,
  /window\.updateBudgetDisplay\b/,
  /window\.foodTraceabilityService\b/,
  /window\.scene\b/,
  /window\.app\.game\b/,
];

/** Files allowed to reference window.app (debug mirror only). */
const READ_GUARD_SKIP_FILES = new Set([
  'composition/AppRegistry.js',
]);

/** `${fileRel}::${lineNumber}` */
const ALLOWLIST = new Set([]);

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

function isCommentOnlyLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
}

describe('architecture globals (Lot 8)', () => {
  test('no direct window.* service assignments outside allowlist', () => {
    const violations = [];

    for (const absolutePath of listJsFiles(SRC_ROOT)) {
      const fileRel = toSrcRelative(absolutePath);
      const lines = fs.readFileSync(absolutePath, 'utf8').split('\n');

      lines.forEach((line, index) => {
        for (const pattern of FORBIDDEN_ASSIGNMENT_RES) {
          if (pattern.test(line)) {
            const key = `${fileRel}::${index + 1}`;
            if (!ALLOWLIST.has(key)) {
              violations.push(`${key}: ${line.trim()}`);
            }
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });

  test('no direct window.* service reads outside allowlist', () => {
    const violations = [];

    for (const absolutePath of listJsFiles(SRC_ROOT)) {
      const fileRel = toSrcRelative(absolutePath);
      if (READ_GUARD_SKIP_FILES.has(fileRel)) {
        continue;
      }

      const lines = fs.readFileSync(absolutePath, 'utf8').split('\n');

      lines.forEach((line, index) => {
        if (isCommentOnlyLine(line)) {
          return;
        }

        for (const pattern of FORBIDDEN_READ_RES) {
          if (pattern.test(line)) {
            const key = `${fileRel}::${index + 1}`;
            if (!ALLOWLIST.has(key)) {
              violations.push(`${key}: ${line.trim()}`);
            }
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });

  test('allowlist is empty', () => {
    expect(ALLOWLIST.size).toBe(0);
  });
});
