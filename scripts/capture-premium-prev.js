const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

const SNAP_ROOT = path.resolve(__dirname, '..', '..', 'SPPED-AD-TEST-snap-479e1f7');
const PORT = 5174;
const OUT_DIR = path.resolve(__dirname, '..', 'output', 'playwright');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function startServer(root, port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      const filePath = path.join(root, urlPath);
      if (!filePath.startsWith(root)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404).end('not found');
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(port, () => resolve(server));
  });
}

async function shoot(page, url, file, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: file, fullPage: true });
  console.log('saved', file);
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await startServer(SNAP_ROOT, PORT);
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const viewports = [
    { name: 'desktop', size: { width: 1440, height: 900 } },
    { name: 'mobile', size: { width: 390, height: 844 } },
  ];

  for (const v of viewports) {
    const out = path.join(OUT_DIR, `premium-verify-prev-newui-${v.name}.png`);
    await shoot(page, `http://localhost:${PORT}/02_dashboard/premium_signup_new.html`, out, v.size);
  }

  await browser.close();
  server.close();
})();
