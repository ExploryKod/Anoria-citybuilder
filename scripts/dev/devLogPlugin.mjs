import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Dev-only: lets the running game hand a diagnostic to the developer's tooling. The page POSTs
 * `{ label, data }` (a diagnostic) or `{ kind: 'console', tag, level, message }` (a tagged console line,
 * relayed by the page — see src/composition/devDiagnostics.js) to `/__dev-log`, and it is appended to
 * `dev-diagnostics.log` at the project root (git-ignored through `*.log`). Tagged console lines whose tag is
 * listed in `DEV_LOG_TAGS` (comma separated, or `all`) are also printed in the terminal running `vite dev`:
 *
 *   DEV_LOG_TAGS=road-access,cycle pnpm dev
 *
 * Only exists under `vite dev`; a production build has no such route.
 *
 * @param {string} rootDir
 */
export function createDevLogPlugin(rootDir) {
  const file = join(rootDir, 'dev-diagnostics.log');
  const shown = new Set((process.env.DEV_LOG_TAGS ?? '').split(',').map((tag) => tag.trim()).filter(Boolean));

  return {
    name: 'dev-log',
    configureServer(server) {
      server.middlewares.use('/__dev-log', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body);
            if (payload.kind === 'console') {
              const { tag, level = 'log', message = '' } = payload;
              // `message` already starts with its `[tag]`: the page relays only lines that do.
              appendFileSync(file, `${new Date().toISOString()} ${level} ${message}\n`);
              if (shown.has('all') || shown.has(tag)) server.config.logger.info(message);
            } else {
              const { label = 'log', data = null } = payload;
              appendFileSync(file, `\n=== ${new Date().toISOString()} ${label} ===\n${JSON.stringify(data, null, 2)}\n`);
            }
            res.statusCode = 204;
          } catch {
            res.statusCode = 400;
          }
          res.end();
        });
      });
    },
  };
}
