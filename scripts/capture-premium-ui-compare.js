const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const PORT = 5173;
const OUT_DIR = path.resolve(ROOT, 'output', 'playwright');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
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

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      const filePath = path.join(ROOT, urlPath);
      if (!filePath.startsWith(ROOT)) {
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
    server.listen(PORT, () => resolve(server));
  });
}

async function shoot(page, url, file, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: file, fullPage: true });
  console.log('saved', file);
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const targets = [
    {
      label: 'new',
      url: `http://localhost:${PORT}/02_dashboard/premium_signup_new.html`,
    },
    {
      label: 'old',
      url: `http://localhost:${PORT}/02_dashboard/premium_signup.html`,
    },
  ];

  const viewports = [
    { name: 'desktop', size: { width: 1440, height: 900 } },
    { name: 'mobile', size: { width: 390, height: 844 } },
  ];

  for (const t of targets) {
    for (const v of viewports) {
      const out = path.join(OUT_DIR, `premium-verify-${t.label}-${v.name}.png`);
      await shoot(page, t.url, out, v.size);
    }
  }

  await browser.close();
  server.close();
})();
