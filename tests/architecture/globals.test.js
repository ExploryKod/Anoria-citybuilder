/**
 * Architecture guard — Lot 8 (D6 globals).
 *
 * Direct window.service = assignments are forbidden outside AppRegistry.
 * Access services via js/acl/appRuntime.js instead.
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
  /window\.workSectionManager\s*=/,
  /window\.multiplayerManager\s*=/,
  /window\.financesSectionManager\s*=/,
  /window\.storageSectionManager\s*=/,
  /window\.factorySectionManager\s*=/,
  /window\.reportSectionManager\s*=/,
  /window\.healthSectionManager\s*=/,
  /window\.parametersPanelManager\s*=/,
  /window\.EventBlocker\s*=/,
  /window\.setActiveTool\s*=/,
  /window\.processLoanPayments\s*=/,
  /window\.loadBudgetStates\s*=/,
  /window\.generateCityMap\s*=/,
  /window\.refreshBudgetStatesModal\s*=/,
  /window\.startObjectives\s*=/,
  /window\.closeObjectives\s*=/,
  /window\.startTutorial\s*=/,
  /window\.closeTutorial\s*=/,
  /window\.openAdministratorPanel\s*=/,
  /window\.closeAdministratorPanel\s*=/,
  /window\.showAdministratorSection\s*=/,
];

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

  test('allowlist is empty', () => {
    expect(ALLOWLIST.size).toBe(0);
  });
});
