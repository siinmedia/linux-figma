const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const fontkit = require('fontkit');

const APP_VERSION = '4.1.0';
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORTS = [44950, 44951, 44952, 18412, 44900, 44910];

const DEFAULT_FONT_DIRS = [
  path.join(process.env.HOME || '', '.fonts'),
  path.join(process.env.HOME || '', '.local/share/fonts'),
  '/usr/share/fonts'
];

// --- Config file support (~/.config/figma-linux/settings.json) ---
function loadConfig() {
  const configDir = process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || '', '.config');
  const configPath = path.join(configDir, 'figma-linux', 'settings.json');
  const defaults = { host: DEFAULT_HOST, port: String(DEFAULT_PORTS[0]), app: { fontDirs: DEFAULT_FONT_DIRS } };
  try {
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return {
        host: raw.host || defaults.host,
        port: raw.port ? String(raw.port) : defaults.port,
        app: { fontDirs: (raw.fontDirs || raw.app?.fontDirs) || defaults.app.fontDirs }
      };
    }
  } catch (e) {
    console.warn(`⚠️  Failed to read config (${configPath}): ${e.message}`);
  }
  return defaults;
}

// --- CLI flags ---
const argv = process.argv.slice(2);
if (argv.includes('-v') || argv.includes('--version')) {
  console.log(APP_VERSION);
  process.exit(0);
}
if (argv.includes('-h') || argv.includes('--help')) {
  console.log(`figma-font-bridge v${APP_VERSION}
Usage: node index.js [-v|--version] [-h|--help] [--port PORT]
  -v, --version   Print version and exit
  -h, --help      Show this help
  --port PORT     Override listen port`);
  process.exit(0);
}

const config = loadConfig();
const HOST = config.host;
const configPortOverride = argv.indexOf('--port');
const primaryPort = configPortOverride !== -1 ? parseInt(argv[configPortOverride + 1], 10) : parseInt(config.port, 10);
const PORTS = [primaryPort, ...DEFAULT_PORTS.filter(p => p !== primaryPort)];

const fontDirs = config.app.fontDirs.filter(d => d && d.length > 0);
const allowedDirs = [...fontDirs];

let fontFilesJson = null;
let fontEntries = [];

function scanFontFiles(dir) {
  let files = [];
  try {
    for (const item of fs.readdirSync(dir)) {
      const itemPath = path.join(dir, item);
      let stat; try { stat = fs.statSync(itemPath); } catch { continue; }
      if (stat.isDirectory()) files = files.concat(scanFontFiles(itemPath));
      else if (/\.(ttf|otf|woff2?)$/i.test(item)) files.push(itemPath);
    }
  } catch (e) {}
  return files;
}

function parseFontMetadata(filePath) {
  try {
    const font = fontkit.openSync(filePath);
    const fontList = font.fonts || [font];
    const out = [];
    for (const f of fontList) {
      const postscriptName = f.postscriptName || '';
      const familyName = f.familyName || '';
      if (!postscriptName && !familyName) continue;

      const fullName = f.fullName || '';
      let style = 'Regular';
      if (/italic|oblique/i.test(fullName)) style = /bold/i.test(fullName) ? 'Bold Italic' : 'Italic';
      else if (/bold|black|heavy/i.test(fullName)) style = 'Bold';
      else if (/light|thin|extra/i.test(fullName)) style = 'Light';
      else if (/medium|semi/i.test(fullName)) style = 'Medium';

      const os2 = f['OS/2'];
      let weight = os2 && os2.usWeightClass ? os2.usWeightClass : 400;
      const italic = (f.italicAngle && f.italicAngle !== 0) ? true
        : (os2 && os2.fsSelection && os2.fsSelection.italic) ? true : false;
      let stretch = 1.0;
      if (os2 && os2.usWidthClass) stretch = os2.usWidthClass / 5;

      const id = postscriptName || `${familyName}-${style}`.replace(/\s+/g, '-');
      out.push({ path: filePath, postscript: postscriptName, family: familyName, id, style, weight, stretch, italic });
    }
    return out;
  } catch (e) { return []; }
}

function buildFontList() {
  const allFiles = [];
  for (const dir of fontDirs) if (fs.existsSync(dir)) allFiles.push(...scanFontFiles(dir));
  console.log(`📂 Found ${allFiles.length} font files`);

  fontEntries = [];
  const byPath = {};
  for (const filePath of allFiles) {
    for (const e of parseFontMetadata(filePath)) {
      fontEntries.push(e);
      (byPath[e.path] = byPath[e.path] || []).push({
        postscript: e.postscript, family: e.family, id: e.id,
        style: e.style, weight: e.weight, stretch: e.stretch, italic: e.italic
      });
    }
  }
  fontFilesJson = JSON.stringify({ version: 4, fontFiles: byPath });
  console.log(`🔤 Loaded ${fontEntries.length} font faces`);
  return fontFilesJson;
}

// --- Auto-rescan: watch font dirs (event-based) + periodic fallback ---
let rescanTimer = null;
let lastSignature = '';

function fontSignature() {
  const parts = [];
  for (const dir of fontDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of scanFontFiles(dir)) {
      try {
        const st = fs.statSync(f);
        parts.push(`${f}:${st.size}:${st.mtimeMs}`);
      } catch (e) {}
    }
  }
  return parts.sort().join('|');
}

function rescan(reason) {
  const sig = fontSignature();
  if (sig === lastSignature) return;       // nothing changed
  lastSignature = sig;
  buildFontList();
  console.log(`🔄 Fonts rescaned (${reason}) — ${fontEntries.length} faces now available`);
}

function scheduleRescan(reason) {
  clearTimeout(rescanTimer);
  rescanTimer = setTimeout(() => rescan(reason), 1500); // debounce bursts
}

function startAutoRescan() {
  lastSignature = fontSignature();
  let watchers = 0;
  for (const dir of fontDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      fs.watch(dir, { recursive: true }, () => scheduleRescan('change'));
      watchers++;
    } catch (e) {
      // recursive watch unsupported — rely on periodic fallback
    }
  }
  // Safety net: re-check every 60s (cheap: stat-only, no parsing if unchanged)
  const interval = setInterval(() => rescan('periodic'), 60000);
  interval.unref();
  console.log(`👀 Auto-rescan enabled (${watchers} watcher(s) + 60s fallback)`);
}

function isAllowedFile(filePath) {
  const resolved = path.resolve(filePath);
  return allowedDirs.some(dir => resolved.startsWith(dir));
}

const app = express();

// --- Logging (only Figma requests + errors; no noise) ---
app.use((req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  const origin = req.headers.origin || '';
  if (origin.includes('figma.com') || /Figma/i.test(ua)) {
    console.log(`[figma] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// --- CORS for Figma ---
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  // Match figma.com and all subdomains
  const allowedOrigin = /figma\.com$/i.test(origin) ? origin : 'https://www.figma.com';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Root / health — Figma may probe this
app.get('/', (req, res) => res.json({ status: 'ok', version: 4, fonts: fontEntries.length }));
app.get('/health', (req, res) => res.json({ status: 'ok', fonts: fontEntries.length }));

// Figma handshake endpoint (modern clients probe this first)
app.get('/figma/version', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify({ version: 4 }));
});

// Official Figma Font Helper endpoints
app.get('/figma/font-files', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(fontFilesJson);
});

app.get('/figma/font-file', (req, res) => {
  const filePath = req.query.file;
  if (!filePath) return res.status(400).send('Missing file parameter');
  if (!isAllowedFile(filePath)) { console.warn(`⚠️  Blocked: ${filePath}`); return res.status(400).send('Incorrect file path'); }
  if (!fs.existsSync(filePath)) return res.status(404).send('File not found');
  try {
    const buf = fs.readFileSync(filePath);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', buf.length);
    res.send(buf);
  } catch (e) { res.status(500).send('Failed to read file'); }
});

// --- Catch-all: return 404 without noisy logging ---
app.use((req, res) => {
  res.status(404).json({ error: 'not found' });
});

// --- Build font list ---
buildFontList();
if (fontEntries.length === 0) {
  console.warn('⚠️  No fonts found. Install fonts to ~/.fonts or ~/.local/share/fonts.');
}
startAutoRescan();

// --- Start servers on all ports ---
const servers = [];
for (const port of PORTS) {
  const srv = http.createServer(app);
  srv.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`   ⏩ Port ${port} in use, skipping`);
    } else {
      console.warn(`⚠️  Port ${port}: ${e.code}`);
    }
  });
  srv.listen(port, HOST, () => {
    servers.push(srv);
    if (servers.length === 1) {
      console.log(`🚀 Figma Font Helper v${APP_VERSION} — http://${HOST}:${port}`);
      console.log(`   Ports: ${PORTS.join(', ')} (primary: ${port})`);
      console.log(`   Fonts: ${fontEntries.length} faces from ${fontDirs.length} dirs`);
      console.log(`   Endpoints: /figma/version  /figma/font-files  /figma/font-file`);
    }
  });
}

// --- Graceful shutdown (SIGTERM/SIGINT — systemd friendly) ---
function shutdown(signal) {
  console.log(`\n🛑 ${signal} received, shutting down...`);
  for (const srv of servers) {
    try { srv.close(); } catch (e) {}
  }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
