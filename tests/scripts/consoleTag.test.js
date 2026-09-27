import { describe, test, expect } from '@jest/globals';
import { filterConsoleTag } from '../../scripts/dev/consoleTag.mjs';

const EXPORT = [
  'client:912 [vite] connected.',
  'roadAccessIcons.js:43 [road-access] no access {"type":"Market-Stall-Red","x":12,"roadCount":0}',
  '(anonymous) @ roadAccessIcons.js:43',
  'game.js:88 [cycle] pottery firing done',
  'roadAccessIcons.js:43 [road-access] no access Object',
].join('\n');

describe('filterConsoleTag', () => {
  test('keeps only the lines carrying the tag, without stack lines or other tags', () => {
    const lines = filterConsoleTag(EXPORT, 'road-access');
    expect(lines).toHaveLength(2);
    expect(lines.some((line) => line.includes('[cycle]') || line.includes('[vite]'))).toBe(false);
  });

  test('strips the source location and pretty-prints a JSON payload', () => {
    const [first, second] = filterConsoleTag(EXPORT, 'road-access');
    expect(first.startsWith('[road-access] no access')).toBe(true);
    expect(first).toContain('"type": "Market-Stall-Red"');
    expect(second).toBe('[road-access] no access Object');
  });

  test('--raw keeps the line as exported', () => {
    expect(filterConsoleTag(EXPORT, 'cycle', { raw: true })).toEqual(['game.js:88 [cycle] pottery firing done']);
  });
});
