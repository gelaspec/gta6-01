// Tiny static file server for local testing and screenshots.
// Serves the repo root on :8080 by default (`node serve.ts --port 8080`
// or PORT=8080 node serve.ts). No dependencies, no build step, no
// network access: every file it serves lives in this repository.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

let port = Number(process.env.PORT || 8080);
const portFlag = process.argv.indexOf('--port');
if (portFlag >= 0 && process.argv[portFlag + 1]) {
  const parsed = Number(process.argv[portFlag + 1]);
  if (Number.isFinite(parsed) && parsed > 0) port = parsed;
}

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    let path = decodeURIComponent(url.pathname);
    // The root redirects to the game page (keeping the query string, so
    // ?shot=... survives): relative module paths then resolve under /game/.
    if (path === '/') {
      res.writeHead(302, { Location: '/game/index.html' + url.search });
      res.end();
      return;
    }
    if (path === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(port, () => {
  console.log(`serving ${root} on http://localhost:${port}/`);
});
