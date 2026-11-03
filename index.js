/**
 * Host half of dsh-background-studio.
 *
 * Owns everything that has to survive a restart: the chosen background and the
 * uploaded image. The Desktop app serves each launch from a fresh port, so the
 * page origin — and with it localStorage and IndexedDB — changes on every
 * restart. A profile file is the only durable place for these preferences.
 *
 * Routes are plain same-origin JSON endpoints consumed by ./client.js.
 */
import { mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const API = '/dsh-background-studio/api';
const MAX_IMAGE_BYTES = 24 * 1024 * 1024;
const MAX_SETTINGS_BYTES = 64 * 1024;
const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const FITS = new Set(['cover', 'contain', 'tile']);

function storeDir() {
  return join(homedir(), '.dsh', 'background-studio');
}

function settingsPath() {
  return join(storeDir(), 'settings.json');
}

function imageMetaPath() {
  return join(storeDir(), 'image.json');
}

function sendJson(response, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store'
  });
  response.end(body);
}

function sendText(response, status, text, headers = {}) {
  const body = Buffer.from(text);
  response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'content-length': body.length, ...headers });
  response.end(body);
}

function readBody(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        const error = new Error('body too large');
        error.status = 413;
        reject(error);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

async function readJsonFile(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Accepts only the keys this plugin owns, with values it can render. */
function normalizeColor(value) {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim();
  const long = /^#?([0-9a-f]{6})$/i.exec(raw);
  if (long) return `#${long[1].toLowerCase()}`;
  const short = /^#?([0-9a-f]{3})$/i.exec(raw);
  if (short) return `#${short[1].split('').map(char => char + char).join('').toLowerCase()}`;
  return undefined;
}

function sanitizeSettings(input) {
  const source = input && typeof input === 'object' ? input : {};
  const out = {};
  if (typeof source.enabled === 'boolean') out.enabled = source.enabled;
  if (typeof source.glass === 'boolean') out.glass = source.glass;
  if (typeof source.customEnabled === 'boolean') out.customEnabled = source.customEnabled;
  if (typeof source.colorEnabled === 'boolean') out.colorEnabled = source.colorEnabled;
  if (typeof source.style === 'string' && /^[a-z0-9-]{1,32}$/.test(source.style)) out.style = source.style;
  if (typeof source.intensity === 'string' && /^[a-z0-9-]{1,16}$/.test(source.intensity)) out.intensity = source.intensity;
  {
    const color = normalizeColor(source.color);
    if (color) out.color = color;
  }
  if (Number.isFinite(source.opacity)) out.opacity = Math.min(100, Math.max(0, Math.round(source.opacity)));
  // Pre-0.2.1 profiles stored an inverted "transparency" value whose 100% hid
  // the backdrop. Treat those old files as fully visible instead of reviving a
  // setting the user could not observe.
  else if (Number.isFinite(source.transparency)) out.opacity = 100;
  if (typeof source.fit === 'string' && FITS.has(source.fit)) out.fit = source.fit;
  return out;
}

async function readSettings() {
  return sanitizeSettings(await readJsonFile(settingsPath(), {}));
}

async function readImage() {
  const meta = await readJsonFile(imageMetaPath(), null);
  if (!meta || typeof meta.url !== 'string' || typeof meta.type !== 'string') return null;
  const updatedAt = Number.isFinite(meta.updatedAt) ? meta.updatedAt : 0;
  return {
    // Derive the URL from the current route instead of trusting the stored one,
    // so a rename of the API cannot leave a stale image URL behind.
    url: `${API}/image${updatedAt ? `?v=${updatedAt}` : ''}`,
    name: typeof meta.name === 'string' ? meta.name : 'background',
    type: EXTENSIONS[meta.type] ? meta.type : 'image/png',
    width: Number.isFinite(meta.width) ? meta.width : 0,
    height: Number.isFinite(meta.height) ? meta.height : 0,
    size: Number.isFinite(meta.size) ? meta.size : 0,
    updatedAt
  };
}

function sniffType(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length > 8 && buffer[0] === 0x89 && buffer.toString('latin1', 1, 4) === 'PNG') return 'image/png';
  if (buffer.length > 12 && buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (buffer.length > 6 && buffer.toString('latin1', 0, 3) === 'GIF') return 'image/gif';
  return undefined;
}

async function clearImageFiles() {
  try {
    const entries = await readdir(storeDir());
    await Promise.all(entries
      .filter((name) => name.startsWith('background.'))
      .map((name) => rm(join(storeDir(), name), { force: true })));
  } catch { /* the directory may not exist yet */ }
  await rm(imageMetaPath(), { force: true });
}

async function handleState(response) {
  sendJson(response, 200, { settings: await readSettings(), image: await readImage() });
}

async function handleSaveSettings(request, response) {
  const body = await readBody(request, MAX_SETTINGS_BYTES);
  let parsed;
  try {
    parsed = JSON.parse(body.toString('utf8') || '{}');
  } catch {
    sendText(response, 400, 'invalid json');
    return;
  }
  const settings = { ...(await readSettings()), ...sanitizeSettings(parsed) };
  await mkdir(storeDir(), { recursive: true });
  await writeFile(settingsPath(), `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  sendJson(response, 200, { settings });
}

async function handleUploadImage(request, response) {
  const url = new URL(request.url, 'http://localhost');
  const body = await readBody(request, MAX_IMAGE_BYTES);
  if (body.length === 0) {
    sendText(response, 400, 'empty body');
    return;
  }
  const declared = String(request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const type = sniffType(body) || (EXTENSIONS[declared] ? declared : undefined);
  if (!type) {
    sendText(response, 415, 'unsupported image type');
    return;
  }
  const width = Number.parseInt(url.searchParams.get('w') || '', 10);
  const height = Number.parseInt(url.searchParams.get('h') || '', 10);
  const rawName = (url.searchParams.get('name') || 'background').replace(/[\\/:*?"<>|]/g, '').slice(0, 120) || 'background';
  const updatedAt = Date.now();

  await clearImageFiles();
  await mkdir(storeDir(), { recursive: true });
  await writeFile(join(storeDir(), `background${EXTENSIONS[type]}`), body);
  await writeFile(imageMetaPath(), `${JSON.stringify({
    name: rawName,
    type,
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
    size: body.length,
    updatedAt,
    url: `${API}/image?v=${updatedAt}`
  }, null, 2)}\n`, 'utf8');

  sendJson(response, 200, { image: await readImage() });
}

async function handleGetImage(request, response) {
  const meta = await readJsonFile(imageMetaPath(), null);
  const type = meta && EXTENSIONS[meta.type] ? meta.type : undefined;
  if (!meta || !type) {
    sendText(response, 404, 'no image');
    return;
  }
  let file;
  try {
    file = await readFile(join(storeDir(), `background${EXTENSIONS[type]}`));
  } catch {
    sendText(response, 404, 'no image');
    return;
  }
  const url = new URL(request.url, 'http://localhost');
  response.writeHead(200, {
    'content-type': type,
    'content-length': file.length,
    'cache-control': url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'no-store'
  });
  response.end(file);
}

async function handleDeleteImage(response) {
  await clearImageFiles();
  sendJson(response, 200, { image: null });
}

export function apply(ctx) {
  ctx.inject(['webServer'], host => {
    host.effect(() => {
      const routes = [
        {
          path: `${API}/state`,
          handler: (request, response) => {
            if (request.method !== 'GET') { sendText(response, 405, 'method not allowed', { allow: 'GET' }); return; }
            return handleState(response);
          }
        },
        {
          path: `${API}/settings`,
          handler: (request, response) => {
            if (request.method !== 'PUT' && request.method !== 'POST') { sendText(response, 405, 'method not allowed', { allow: 'PUT' }); return; }
            return handleSaveSettings(request, response);
          }
        },
        {
          path: `${API}/image`,
          handler: (request, response) => {
            if (request.method === 'GET') return handleGetImage(request, response);
            if (request.method === 'POST' || request.method === 'PUT') return handleUploadImage(request, response);
            if (request.method === 'DELETE') return handleDeleteImage(response);
            sendText(response, 405, 'method not allowed', { allow: 'GET, POST, DELETE' });
          }
        }
      ];
      const disposers = routes.map(route => host.webServer.register({
        kind: 'exact',
        path: route.path,
        handler: (request, response) => {
          Promise.resolve()
            .then(() => route.handler(request, response))
            .catch((error) => {
              const status = Number.isInteger(error?.status) ? error.status : 500;
              if (!response.headersSent) sendText(response, status, status === 413 ? 'body too large' : 'internal error');
              else response.end();
            });
        }
      }));
      return () => { for (const dispose of disposers) { try { dispose?.(); } catch { /* already gone */ } } };
    });
  });
}
