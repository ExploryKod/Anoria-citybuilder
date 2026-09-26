#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Filters a console export saved from the browser's DevTools (`localhost-<number>.log`) down to the
 * lines that carry one tag, e.g. `[road-access]`, so only those reach the terminal.
 *
 *   node scripts/dev/consoleTag.mjs road-access            newest localhost-*.log in the project root
 *   node scripts/dev/consoleTag.mjs road-access some.log   a given export
 *   node scripts/dev/consoleTag.mjs road-access --raw      keep the source location prefix, no JSON pretty-print
 *
 * Only text survives an export: an object logged as an object is saved as "Object". Log the tagged
 * message as a string (or JSON.stringify it) to have its content here.
 */

const LOCATION_PREFIX = /^\S+\.(?:js|mjs|ts|vue):\d+\s+/;

/**
 * @param {string} text The exported console.
 * @param {string} tag The tag without brackets.
 * @param {{ raw?: boolean }} [options]
 * @returns {string[]} One entry per tagged line; a JSON payload after the tag is pretty-printed.
 */
export function filterConsoleTag(text, tag, { raw = false } = {}) {
  const marker = `[${tag}]`;
  const found = [];
  for (const line of text.split(/\r?\n/)) {
    const at = line.indexOf(marker);
    if (at === -1) continue;
    if (raw) {
      found.push(line);
      continue;
    }
    const message = line.replace(LOCATION_PREFIX, '');
    const jsonStart = message.indexOf('{', message.indexOf(marker) + marker.length);
    if (jsonStart !== -1) {
      try {
        const payload = JSON.parse(message.slice(jsonStart));
        found.push(`${message.slice(0, jsonStart).trimEnd()}\n${JSON.stringify(payload, null, 2)}`);
        continue;
      } catch {
        // not JSON: keep the line as it is
      }
    }
    found.push(message);
  }
  return found;
}

/** @param {string} dir The newest `localhost-*.log` in it, or null. */
function newestExport(dir) {
  const files = readdirSync(dir)
    .filter((name) => /^localhost-.*\.log$/.test(name))
    .map((name) => ({ name, mtime: statSync(join(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return files[0] ? join(dir, files[0].name) : null;
}

function main() {
  const args = process.argv.slice(2);
  const raw = args.includes('--raw');
  const [tag, file] = args.filter((arg) => !arg.startsWith('--'));
  if (!tag) {
    console.error('usage: node scripts/dev/consoleTag.mjs <tag> [export.log] [--raw]');
    process.exit(2);
  }
  const path = file ?? newestExport(process.cwd());
  if (!path) {
    console.error('no localhost-*.log found in this directory');
    process.exit(1);
  }
  const lines = filterConsoleTag(readFileSync(path, 'utf8'), tag, { raw });
  console.error(`${lines.length} line(s) tagged [${tag}] in ${path}`);
  for (const line of lines) console.log(line);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
