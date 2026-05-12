import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function contentTypeByExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.ico': return 'image/x-icon';
    case '.map': return 'application/json; charset=utf-8';
    default: return 'application/octet-stream';
  }
}

function sanitizeRelativePath(urlPathname: string): string {
  const normalized = path.posix.normalize(urlPathname).replace(/^(\.\.(\/|\\|$))+/, '');
  return normalized.startsWith('/') ? normalized.slice(1) : normalized;
}

function injectRuntimeConfig(html: string): string {
  const websocketUrl = process.env.VITE_WEBSOCKET_URL;
  const configScript = [
    '<script>',
    `window.__OPENMCP_RUNTIME_CONFIG__ = ${JSON.stringify({ websocketUrl })};`,
    '</script>'
  ].join('');

  if (html.includes('__OPENMCP_RUNTIME_CONFIG__')) {
    return html;
  }

  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>\n    ${configScript}`);
  }

  return html.replace('</head>', `    ${configScript}\n  </head>`);
}

function createStaticWebServer(distDir: string) {
  return http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/__openmcp_web_health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({ app: 'openmcp-web-ui', mode: 'static' }));
      return;
    }

    if (pathname === '/' || pathname === '') {
      res.writeHead(302, { Location: '/mcp/' });
      res.end();
      return;
    }

    // 兼容两类构建产物：
    // 1) base=/mcp/ 时资源路径为 /mcp/assets/*
    // 2) base=/   时资源路径为 /assets/* 或 /default-dark.css
    let relative = '';
    let spaFallback = false;
    if (pathname === '/mcp/') {
      relative = 'index.html';
      spaFallback = true;
    } else if (pathname.startsWith('/mcp/')) {
      relative = sanitizeRelativePath(pathname.slice('/mcp/'.length));
      spaFallback = true;
    } else {
      relative = sanitizeRelativePath(pathname);
      // 对无扩展名路径（如 /debug、/settings）做 SPA 回退，支持手动刷新
      spaFallback = path.extname(pathname) === '';
    }

    const target = path.join(distDir, relative);

    if (!target.startsWith(distDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    let filePath = target;
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      if (spaFallback) {
        filePath = path.join(distDir, 'index.html');
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }
    }

    try {
      let body: string | Buffer = fs.readFileSync(filePath);
      const cacheControl = filePath.endsWith('index.html')
        ? 'no-cache'
        : relative.startsWith('assets/')
          ? 'public, max-age=31536000, immutable'
          : 'no-cache';
      if (filePath.endsWith('index.html')) {
        body = injectRuntimeConfig(body.toString('utf-8'));
      }

      res.writeHead(200, {
        'Content-Type': contentTypeByExt(filePath),
        'Cache-Control': cacheControl
      });
      res.end(body);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
    }
  });
}

export function runStaticWebServer(distDir: string, port: number) {
  const server = createStaticWebServer(distDir);
  server.listen(port, () => {
    console.log(`Static web server ready at http://localhost:${port}/mcp/`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const distDir = process.env.RENDERER_DIST_DIR || path.resolve(__dirname, '../../../renderer/dist');
  const port = parseInt(process.env.PORT || '8283', 10);
  runStaticWebServer(distDir, port);
}
