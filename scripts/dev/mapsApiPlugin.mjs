import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseEditorMapLayout, serializeEditorMapLayoutDocument } from '../../src/contexts/world-layout/domain/validateEditorMapLayout.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {string} mapsDir
 */
export function createMapsApiPlugin(mapsDir) {
  mkdirSync(mapsDir, { recursive: true });

  /**
   * @param {string} filePath
   */
  function readLayoutSummary(filePath) {
    const raw = JSON.parse(readFileSync(filePath, 'utf8'));
    const layout = parseEditorMapLayout(raw);
    return {
      id: layout.id,
      name: layout.name,
      citySize: layout.citySize,
      fileName: filePath.split(/[/\\]/).pop(),
    };
  }

  function listMapFiles() {
    return readdirSync(mapsDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => join(mapsDir, name));
  }

  /**
   * @param {string} id
   */
  function findFileById(id) {
    for (const filePath of listMapFiles()) {
      try {
        const summary = readLayoutSummary(filePath);
        if (summary.id === id) {
          return filePath;
        }
      } catch {
        /* skip invalid files */
      }
    }
    return null;
  }

  /**
   * @param {import('http').IncomingMessage} req
   * @returns {Promise<string>}
   */
  function readRequestBody(req) {
    return new Promise((resolveBody, reject) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }

  return {
    name: 'anoria-maps-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/maps')) {
          next();
          return;
        }

        const url = new URL(req.url, 'http://local');
        const pathname = url.pathname;

        try {
          if (req.method === 'GET' && pathname === '/api/maps') {
            const maps = listMapFiles()
              .map((filePath) => {
                try {
                  const summary = readLayoutSummary(filePath);
                  return { id: summary.id, name: summary.name, citySize: summary.citySize };
                } catch {
                  return null;
                }
              })
              .filter(Boolean)
              .sort((a, b) => a.name.localeCompare(b.name));

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ maps }));
            return;
          }

          const loadMatch = pathname.match(/^\/api\/maps\/([^/]+)$/);
          if (req.method === 'GET' && loadMatch) {
            const id = decodeURIComponent(loadMatch[1]);
            const filePath = findFileById(id);
            if (!filePath) {
              res.statusCode = 404;
              res.end('Map not found');
              return;
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(readFileSync(filePath, 'utf8'));
            return;
          }

          if (req.method === 'POST' && pathname === '/api/maps') {
            const body = await readRequestBody(req);
            const raw = JSON.parse(body);
            const layout = parseEditorMapLayout(raw);

            if (findFileById(layout.id)) {
              res.statusCode = 409;
              res.end(`Map uuid already exists: ${layout.id}`);
              return;
            }

            const targetPath = join(mapsDir, `${layout.id}.json`);
            writeFileSync(
              targetPath,
              `${JSON.stringify(serializeEditorMapLayoutDocument(layout), null, 2)}\n`,
              'utf8'
            );

            res.statusCode = 201;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ id: layout.id, name: layout.name, citySize: layout.citySize }));
            return;
          }

          if (req.method === 'DELETE' && loadMatch) {
            const id = decodeURIComponent(loadMatch[1]);
            if (!UUID_RE.test(id)) {
              res.statusCode = 400;
              res.end('Invalid map id');
              return;
            }
            const filePath = findFileById(id);
            if (!filePath) {
              res.statusCode = 404;
              res.end('Map not found');
              return;
            }
            unlinkSync(filePath);
            res.statusCode = 204;
            res.end();
            return;
          }

          res.statusCode = 405;
          res.end('Method not allowed');
        } catch (error) {
          res.statusCode = 400;
          res.end(error instanceof Error ? error.message : 'Bad request');
        }
      });
    },
  };
}

/**
 * @param {string} projectRoot
 */
export function resolveMapsDirectory(projectRoot) {
  return resolve(projectRoot, 'public/maps');
}
