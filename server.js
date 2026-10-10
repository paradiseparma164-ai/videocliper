const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const http = require('http');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

const USERS_PATH = path.join(DATA_DIR, 'users.json');
const PROJECTS_PATH = path.join(DATA_DIR, 'projects.json');
const SESSIONS_PATH = path.join(DATA_DIR, 'sessions.json');
const RENDERS_PATH = path.join(DATA_DIR, 'renders.json');
const PLATFORMS_PATH = path.join(DATA_DIR, 'platforms.json');

const DEFAULT_SESSIONS = {};
const DEFAULT_USERS = [];
const DEFAULT_PROJECTS = [];
const DEFAULT_RENDERS = [];
const DEFAULT_PLATFORMS = {};

const REQUEST_LIMITS = new Map();

function ensureStorage() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const [pathValue, fallback] of [
    [USERS_PATH, DEFAULT_USERS],
    [PROJECTS_PATH, DEFAULT_PROJECTS],
    [SESSIONS_PATH, DEFAULT_SESSIONS],
    [RENDERS_PATH, DEFAULT_RENDERS],
    [PLATFORMS_PATH, DEFAULT_PLATFORMS],
  ]) {
    if (!fs.existsSync(pathValue)) {
      fs.writeFileSync(pathValue, JSON.stringify(fallback, null, 2));
    }
  }
}

function readJson(filePath, fallback) {
  try {
    const row = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(row || 'null') ?? fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function generateId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function getClientIp(req) {
  const headers = req.headers || {};
  if (TRUST_PROXY && headers['x-forwarded-for']) {
    return String(headers['x-forwarded-for']).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function applySecurityHeaders(res) {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' http://localhost:3000; frame-ancestors 'none'; base-uri 'self'; form-action 'self';");
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function getSessionStore() {
  return readJson(SESSIONS_PATH, DEFAULT_SESSIONS);
}

function setSessionStore(data) {
  writeJson(SESSIONS_PATH, data);
}

function getUserStore() {
  return readJson(USERS_PATH, DEFAULT_USERS);
}

function setUserStore(data) {
  writeJson(USERS_PATH, data);
}

function getProjectStore() {
  return readJson(PROJECTS_PATH, DEFAULT_PROJECTS);
}

function setProjectStore(data) {
  writeJson(PROJECTS_PATH, data);
}

function getRenderStore() {
  return readJson(RENDERS_PATH, DEFAULT_RENDERS);
}

function setRenderStore(data) {
  writeJson(RENDERS_PATH, data);
}

function getPlatformStore() {
  return readJson(PLATFORMS_PATH, DEFAULT_PLATFORMS);
}

function setPlatformStore(data) {
  writeJson(PLATFORMS_PATH, data);
}

function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies.clipforge_session;
  const sessions = getSessionStore();
  if (!token || !sessions[token]) {
    return null;
  }
  return sessions[token];
}

function parseCookies(cookieHeader) {
  const result = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key) {
      result[key] = decodeURIComponent(rest.join('='));
    }
  }
  return result;
}

function setSessionCookie(res, sessionId) {
  const secure = BASE_URL.startsWith('https://') ? '; Secure' : '';
  res.setHeader('Set-Cookie', `clipforge_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax${secure}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'clipforge_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function ensureRateLimit(req) {
  const key = `${getClientIp(req)}:${req.url}`;
  const now = Date.now();
  const bucket = REQUEST_LIMITS.get(key) || { count: 0, reset: now + 60000 };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + 60000;
  }
  bucket.count += 1;
  REQUEST_LIMITS.set(key, bucket);
  return bucket.count <= 60;
}

function sendJson(res, code, payload) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function serveFile(res, filePath) {
  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
    }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch (error) {
    sendJson(res, 404, { error: 'File not found' });
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createCsrfToken() {
  return crypto.randomBytes(18).toString('hex');
}

function getUserByEmail(email) {
  const users = getUserStore();
  return users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
}

function getCurrentUser(req) {
  const session = getSessionFromRequest(req);
  if (!session) return null;
  const users = getUserStore();
  return users.find((user) => user.id === session.userId) || null;
}

function requireAuth(req, res) {
  const user = getCurrentUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'Authentication required' });
    return null;
  }
  return user;
}

function validateProjectInput(body) {
  const required = {
    title: 'string',
    rightsConfirmed: 'boolean',
    ownershipConfirmation: 'string',
    platform: 'string',
  };

  for (const [key, type] of Object.entries(required)) {
    if (typeof body[key] !== type || (type === 'string' && !body[key].trim())) {
      return `Missing or invalid field: ${key}`;
    }
  }

  if (!body.rightsConfirmed) {
    return 'Project cannot exist without explicit ownership confirmation.';
  }

  if (body.musicTitle || body.musicLicense || body.musicPermission) {
    if (!body.musicTitle || !body.musicLicense || body.musicPermission !== true) {
      return 'Music needs a title, a license, and an explicit permission tick before rendering.';
    }
  }

  return null;
}

function getProjectStatusByPlatform(project) {
  return project.status || 'draft';
}

function createMockRender(project) {
  const ffmpegAvailable = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });

  const outputId = generateId('render');
  const outputFile = path.join(__dirname, 'data', `${outputId}.mp4`);
  const logFile = path.join(__dirname, 'data', `${outputId}.log`);

  let status = 'rendered';
  let message = 'Local render queued with FFmpeg';

  if (ffmpegAvailable.status === 0) {
    const ffmpegCommand = [
      '-f', 'lavfi', '-i', 'color=c=#101827:s=1280x720:d=1',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
      '-shortest', '-pix_fmt', 'yuv420p', outputFile,
    ];
    const result = spawnSync('ffmpeg', ffmpegCommand, { stdio: 'pipe' });
    if (result.error) {
      status = 'failed';
      message = result.error.message;
    } else {
      fs.writeFileSync(logFile, JSON.stringify({ projectId: project.id, ffmpeg: 'ok', createdAt: new Date().toISOString() }, null, 2));
    }
  } else {
    status = 'failed';
    message = 'FFmpeg is not installed or is not on PATH.';
  }

  return {
    id: outputId,
    projectId: project.id,
    status,
    message,
    outputPath: outputFile,
    createdAt: new Date().toISOString(),
  };
}

function platformIsConfigured(platform) {
  const store = getPlatformStore();
  return !!(store[platform] && store[platform].connected);
}

function buildReferenceProfile(payload) {
  const style = payload.style || 'creator-led storytelling';
  return {
    source: payload.source || 'reference input',
    values: {
      hookStructure: '3-part hook: premise → tension → payoff',
      pacing: 'tight 6 to 10 second beats with emotional contrast',
      framing: '9:16 vertical framing with subject centered in safe area',
      captionRhythm: '2 lines max, bold verbs, 10-15 words',
      transitionLanguage: 'match-cut, arc reveal, direct punchline',
      pattern: 'hook → proof → payoff → CTA',
    },
    remixPlan: {
      title: `${style} remix plan`,
      hook: 'Use a contrast-led opener and land the payoff in the first 2 seconds.',
      beatPlan: ['Open on a clean reaction shot', 'Deliver the problem in one sentence', 'Show proof or proof-of-result', 'End with a single CTA'],
      soundBed: 'Use an original or licensed sound bed with low-volume tension swell.',
      memeSlot: 'Only use owned or licensed meme frames and labels.',
    },
    rightsSafe: true,
    generatedAt: new Date().toISOString(),
  };
}

function buildGeneratorBrief(mode) {
  const modes = {
    photorealistic: {
      label: 'Photorealistic',
      description: 'Naturalistic motion, realistic light, subtle texture and camera behavior.',
      guardrail: 'Use approved likenesses, licensed assets, and no impersonation.',
      shotBrief: 'Cinematic close-up, diffused daylight, controlled motion, realistic depth and subtle grain.'
    },
    cartoon3d: {
      label: '3D Cartoon',
      description: 'Stylized 3D animation with clear shape language and expressive motion.',
      guardrail: 'Use original characters, licensed assets, and no copied likenesses.',
      shotBrief: 'Large expressive silhouettes, layered depth, bright punchy color and polished motion.'
    },
    animation: {
      label: 'Animation',
      description: 'Illustrated character motion with simplified forms and emotional beats.',
      guardrail: 'Use original or licensed artwork only.',
      shotBrief: 'Snappy motion arcs, high readability, layered parallax and smooth transitions.'
    },
    sports: {
      label: 'Sports',
      description: 'Broadcast-style motion, crowd atmosphere and match-day energy.',
      guardrail: 'Use authorized teams, brands, players, and footage only.',
      shotBrief: 'Fast tracking shots, authentic pacing, crowd ambience and clear action framing.'
    }
  };

  return modes[mode] || modes.photorealistic;
}

function handleApi(req, res) {
  const parsedUrl = new URL(req.url, BASE_URL);
  const pathname = parsedUrl.pathname;

  if (!ensureRateLimit(req)) {
    sendJson(res, 429, { error: 'Too many requests. Please slow down.' });
    return;
  }

  applySecurityHeaders(res);

  if (pathname === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'ClipForge Studio', ffmpegAvailable: spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0 });
    return;
  }

  if (pathname === '/api/session') {
    const user = getCurrentUser(req);
    sendJson(res, 200, { user: user ? { id: user.id, email: user.email } : null });
    return;
  }

  if (pathname === '/api/auth/signup' && req.method === 'POST') {
    parseBody(req).then((body) => {
      const email = String(body.email || '').trim();
      const password = String(body.password || '');
      if (!isValidEmail(email) || password.length < 8) {
        sendJson(res, 400, { error: 'Use a valid email and a password with at least 8 characters.' });
        return;
      }
      const users = getUserStore();
      if (getUserByEmail(email)) {
        sendJson(res, 409, { error: 'An account already exists with that email.' });
        return;
      }
      const user = { id: generateId('user'), email, passwordHash: sha256(password), createdAt: new Date().toISOString() };
      users.push(user);
      setUserStore(users);
      const sessionId = generateId('session');
      const sessions = getSessionStore();
      sessions[sessionId] = { userId: user.id, createdAt: new Date().toISOString(), csrfToken: createCsrfToken() };
      setSessionStore(sessions);
      setSessionCookie(res, sessionId);
      sendJson(res, 201, { user: { id: user.id, email: user.email }, csrfToken: sessions[sessionId].csrfToken });
    }).catch((error) => {
      sendJson(res, 400, { error: error.message || 'Could not parse signup request' });
    });
    return;
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    parseBody(req).then((body) => {
      const email = String(body.email || '').trim();
      const password = String(body.password || '');
      const user = getUserByEmail(email);
      if (!user || user.passwordHash !== sha256(password)) {
        sendJson(res, 401, { error: 'Invalid email or password.' });
        return;
      }
      const sessionId = generateId('session');
      const sessions = getSessionStore();
      sessions[sessionId] = { userId: user.id, createdAt: new Date().toISOString(), csrfToken: createCsrfToken() };
      setSessionStore(sessions);
      setSessionCookie(res, sessionId);
      sendJson(res, 200, { user: { id: user.id, email: user.email }, csrfToken: sessions[sessionId].csrfToken });
    }).catch((error) => {
      sendJson(res, 400, { error: error.message || 'Could not parse login request' });
    });
    return;
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const session = getSessionFromRequest(req);
    if (session) {
      const sessions = getSessionStore();
      delete sessions[Object.keys(sessions).find((key) => sessions[key].userId === session.userId)];
      setSessionStore(sessions);
    }
    clearSessionCookie(res);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === '/api/auth/logout-everywhere' && req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const sessions = getSessionStore();
    for (const key of Object.keys(sessions)) {
      if (sessions[key].userId === user.id) {
        delete sessions[key];
      }
    }
    setSessionStore(sessions);
    clearSessionCookie(res);
    sendJson(res, 200, { ok: true, message: 'Signed out everywhere.' });
    return;
  }

  const user = getCurrentUser(req);

  if (pathname === '/api/projects' && req.method === 'GET') {
    if (!user) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }
    const projects = getProjectStore().filter((project) => project.userId === user.id);
    sendJson(res, 200, { projects });
    return;
  }

  if (pathname === '/api/projects' && req.method === 'POST') {
    if (!user) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }
    parseBody(req).then((body) => {
      const validationError = validateProjectInput(body);
      if (validationError) {
        sendJson(res, 400, { error: validationError });
        return;
      }
      const project = {
        id: generateId('project'),
        userId: user.id,
        title: String(body.title).trim(),
        platform: String(body.platform).trim(),
        status: 'draft',
        rightsConfirmed: Boolean(body.rightsConfirmed),
        ownershipConfirmation: String(body.ownershipConfirmation || '').trim(),
        musicTitle: body.musicTitle || null,
        musicLicense: body.musicLicense || null,
        musicPermission: Boolean(body.musicPermission),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const projects = getProjectStore();
      projects.push(project);
      setProjectStore(projects);
      sendJson(res, 201, { project, message: 'Project created successfully.' });
    }).catch((error) => {
      sendJson(res, 400, { error: error.message || 'Invalid project payload' });
    });
    return;
  }

  if (pathname.startsWith('/api/projects/') && req.method === 'GET') {
    if (!user) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }
    const projectId = pathname.split('/')[3];
    const project = getProjectStore().find((item) => item.id === projectId && item.userId === user.id);
    if (!project) {
      sendJson(res, 404, { error: 'Project not found' });
      return;
    }
    const projectRenders = getRenderStore().filter((item) => item.projectId === project.id);
    sendJson(res, 200, { project, renders: projectRenders });
    return;
  }

  if (pathname.startsWith('/api/projects/') && req.method === 'POST' && pathname.includes('/render')) {
    if (!user) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }
    const projectId = pathname.split('/')[2];
    const projects = getProjectStore();
    const project = projects.find((item) => item.id === projectId && item.userId === user.id);
    if (!project) {
      sendJson(res, 404, { error: 'Project not found' });
      return;
    }
    if (!project.rightsConfirmed || !project.ownershipConfirmation) {
      sendJson(res, 403, { error: 'Rendering is blocked without explicit ownership confirmation.' });
      return;
    }
    if ((project.musicTitle || project.musicLicense || project.musicPermission) && (!project.musicTitle || !project.musicLicense || !project.musicPermission)) {
      sendJson(res, 403, { error: 'Music needs a title, a license and permission before it can be rendered.' });
      return;
    }

    const renderRecord = createMockRender(project);
    const renders = getRenderStore();
    renders.push(renderRecord);
    setRenderStore(renders);

    project.status = renderRecord.status === 'rendered' ? 'approved' : 'failed';
    project.updatedAt = new Date().toISOString();
    const index = projects.findIndex((item) => item.id === project.id);
    if (index >= 0) projects[index] = project;
    setProjectStore(projects);

    sendJson(res, 200, { ok: true, render: renderRecord, project });
    return;
  }

  if (pathname === '/api/scheduler' && req.method === 'POST') {
    const authUser = requireAuth(req, res);
    if (!authUser) return;
    parseBody(req).then((body) => {
      const projectId = String(body.projectId || '');
      const cadence = String(body.cadence || 'manual');
      const schedule = {
        id: generateId('schedule'),
        userId: authUser.id,
        projectId,
        cadence,
        autoPublish: false,
        scheduledAt: body.scheduledAt || new Date().toISOString(),
        status: 'scheduled',
      };
      sendJson(res, 200, { schedule, message: 'Schedule created. Auto-publish remains off by default.' });
    }).catch((error) => {
      sendJson(res, 400, { error: error.message || 'Invalid schedule request' });
    });
    return;
  }

  if (pathname === '/api/reference/analyze' && req.method === 'POST') {
    const authUser = requireAuth(req, res);
    if (!authUser) return;
    parseBody(req).then((body) => {
      const result = buildReferenceProfile(body || {});
      sendJson(res, 200, result);
    }).catch((error) => {
      sendJson(res, 400, { error: error.message || 'Reference analysis failed' });
    });
    return;
  }

  if (pathname === '/api/generator/brief' && req.method === 'POST') {
    const authUser = requireAuth(req, res);
    if (!authUser) return;
    parseBody(req).then((body) => {
      const mode = String(body.mode || 'photorealistic');
      sendJson(res, 200, { mode, brief: buildGeneratorBrief(mode) });
    }).catch((error) => {
      sendJson(res, 400, { error: error.message || 'Generator brief failed' });
    });
    return;
  }

  if (pathname.startsWith('/api/connect/') && req.method === 'GET') {
    const authUser = requireAuth(req, res);
    if (!authUser) return;
    const platform = pathname.split('/')[3];
    const connectUrl = `${BASE_URL}/api/connect/${platform}/callback?code=mock_${platform}_code&userId=${authUser.id}`;
    sendJson(res, 200, { platform, authUrl: connectUrl, status: 'mock_connect_ready' });
    return;
  }

  if (pathname.startsWith('/api/connect/') && req.method === 'POST' && pathname.endsWith('/callback')) {
    const authUser = requireAuth(req, res);
    if (!authUser) return;
    const platform = pathname.split('/')[3];
    parseBody(req).then((body) => {
      const store = getPlatformStore();
      store[platform] = {
        connected: true,
        userId: authUser.id,
        accessToken: `mock_${platform}_token`,
        accountName: body.accountName || `${platform} Creator`,
        connectedAt: new Date().toISOString(),
      };
      setPlatformStore(store);
      sendJson(res, 200, { ok: true, platform, account: store[platform].accountName });
    }).catch((error) => {
      sendJson(res, 400, { error: error.message || 'Could not save platform connection' });
    });
    return;
  }

  if (pathname === '/api/platforms' && req.method === 'GET') {
    const authUser = requireAuth(req, res);
    if (!authUser) return;
    const store = getPlatformStore();
    const filtered = Object.fromEntries(Object.entries(store).filter(([, value]) => value.userId === authUser.id));
    sendJson(res, 200, { platforms: filtered });
    return;
  }

  if (pathname === '/manus-routes.json') {
    serveFile(res, path.join(__dirname, 'manus-routes.json'));
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

function servePage(req, res, fileName) {
  const filePath = path.join(PUBLIC_DIR, fileName);
  serveFile(res, filePath);
}

function handleStatic(req, res) {
  const parsedUrl = new URL(req.url, BASE_URL);
  let pathname = parsedUrl.pathname;

  if (pathname === '/') {
    servePage(req, res, 'index.html');
    return;
  }

  if (pathname === '/app') {
    servePage(req, res, 'app.html');
    return;
  }

  if (pathname === '/favicon.ico') {
    servePage(req, res, 'favicon.svg');
    return;
  }

  const safePath = pathname.replace(/^\/+/, '');
  const finalPath = path.join(PUBLIC_DIR, safePath);
  if (finalPath.startsWith(PUBLIC_DIR) && fs.existsSync(finalPath)) {
    serveFile(res, finalPath);
    return;
  }

  servePage(req, res, 'index.html');
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, BASE_URL);
  applySecurityHeaders(res);

  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res);
    return;
  }

  if (url.pathname === '/' || url.pathname === '/app' || url.pathname.startsWith('/styles') || url.pathname.startsWith('/js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.js') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.png') || url.pathname.endsWith('.jpg') || url.pathname.endsWith('.jpeg') || url.pathname.endsWith('.webp') || url.pathname.endsWith('.ico')) {
    handleStatic(req, res);
    return;
  }

  if (url.pathname === '/manus-routes.json') {
    serveFile(res, path.join(__dirname, 'manus-routes.json'));
    return;
  }

  handleStatic(req, res);
});

ensureStorage();

server.listen(PORT, HOST, () => {
  console.log(`ClipForge Studio listening on http://${HOST}:${PORT}`);
});
