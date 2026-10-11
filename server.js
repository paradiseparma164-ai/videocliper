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
const WORKFLOWS_PATH = path.join(DATA_DIR, 'workflows.json');

const DEFAULTS = {
  users: [],
  projects: [],
  sessions: {},
  renders: [],
  platforms: {},
  workflows: [],
};

const REQUEST_LIMITS = new Map();

function ensureStorage() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const [filePath, fallback] of [
    [USERS_PATH, DEFAULTS.users],
    [PROJECTS_PATH, DEFAULTS.projects],
    [SESSIONS_PATH, DEFAULTS.sessions],
    [RENDERS_PATH, DEFAULTS.renders],
    [PLATFORMS_PATH, DEFAULTS.platforms],
    [WORKFLOWS_PATH, DEFAULTS.workflows],
  ]) {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
    }
  }
}

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw || 'null') ?? fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function generateId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (TRUST_PROXY && forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
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
  return bucket.count <= 100;
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key) cookies[key] = decodeURIComponent(rest.join('='));
  }
  return cookies;
}

function getSessionStore() {
  return readJson(SESSIONS_PATH, DEFAULTS.sessions);
}

function setSessionStore(data) {
  writeJson(SESSIONS_PATH, data);
}

function getUserStore() {
  return readJson(USERS_PATH, DEFAULTS.users);
}

function setUserStore(data) {
  writeJson(USERS_PATH, data);
}

function getProjectStore() {
  return readJson(PROJECTS_PATH, DEFAULTS.projects);
}

function setProjectStore(data) {
  writeJson(PROJECTS_PATH, data);
}

function getRenderStore() {
  return readJson(RENDERS_PATH, DEFAULTS.renders);
}

function setRenderStore(data) {
  writeJson(RENDERS_PATH, data);
}

function getPlatformStore() {
  return readJson(PLATFORMS_PATH, DEFAULTS.platforms);
}

function setPlatformStore(data) {
  writeJson(PLATFORMS_PATH, data);
}

function getWorkflowStore() {
  return readJson(WORKFLOWS_PATH, DEFAULTS.workflows);
}

function setWorkflowStore(data) {
  writeJson(WORKFLOWS_PATH, data);
}

function createCsrfToken() {
  return crypto.randomBytes(18).toString('hex');
}

function setSessionCookie(res, sessionId) {
  const secure = BASE_URL.startsWith('https://') ? '; Secure' : '';
  res.setHeader('Set-Cookie', `clipforge_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax${secure}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'clipforge_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

function getSessionFromRequest(req) {
  const sessionCookie = parseCookies(req.headers.cookie || '').clipforge_session;
  const sessions = getSessionStore();
  if (!sessionCookie || !sessions[sessionCookie]) return null;
  return sessions[sessionCookie];
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

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(payload));
}

function applySecurityHeaders(res) {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' http://localhost:3000; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

function getUserByEmail(email) {
  const users = getUserStore();
  return users.find((user) => user.email.toLowerCase() === String(email).toLowerCase());
}

function validateProjectInput(body) {
  if (!body || typeof body !== 'object') return 'Invalid project payload';
  if (!body.title || !String(body.title).trim()) return 'Project title is required';
  if (typeof body.rightsConfirmed !== 'boolean' || !body.rightsConfirmed) {
    return 'Project cannot exist without explicit ownership confirmation.';
  }
  if (!body.ownershipConfirmation || !String(body.ownershipConfirmation).trim()) {
    return 'Ownership confirmation is required';
  }
  if (body.musicTitle || body.musicLicense || body.musicPermission !== undefined) {
    if (!body.musicTitle || !body.musicLicense || body.musicPermission !== true) {
      return 'Music needs a title, a license, and a permission tick before rendering.';
    }
  }
  return null;
}

function createRender(project) {
  const ffmpegAvailable = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  const renderId = generateId('render');
  const outputPath = path.join(DATA_DIR, `${renderId}.mp4`);
  const logPath = path.join(DATA_DIR, `${renderId}.log`);

  let status = 'rendered';
  let message = 'Render completed locally with FFmpeg';

  if (ffmpegAvailable.status !== 0) {
    status = 'failed';
    message = 'FFmpeg is not installed or not in PATH on this system.';
  } else {
    const result = spawnSync('ffmpeg', [
      '-f', 'lavfi', '-i', 'color=c=#101827:s=1280x720:d=3',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
      '-shortest', '-pix_fmt', 'yuv420p', outputPath,
    ], { stdio: 'pipe' });

    if (result.error) {
      status = 'failed';
      message = result.error.message;
    } else {
      fs.writeFileSync(logPath, JSON.stringify({ projectId: project.id, renderedAt: new Date().toISOString(), ffmpeg: 'ok' }, null, 2));
    }
  }

  return {
    id: renderId,
    projectId: project.id,
    createdAt: new Date().toISOString(),
    status,
    message,
    outputPath,
    previewUrl: status === 'rendered' ? `/api/media/${renderId}.mp4` : null,
  };
}

function buildReferenceProfile(payload = {}) {
  const source = payload.source || 'reference input';
  return {
    source,
    rightsSafe: true,
    generatedAt: new Date().toISOString(),
    values: {
      hookStructure: '3-part hook: premise → tension → payoff',
      pacing: 'tight 6-10 second beats with emotional contrast',
      framing: '9:16 portrait-safe focus with subject centered in safe area',
      captionRhythm: 'two-line max with scalable visual hierarchy',
      transitionLanguage: 'match cuts, direct payoff, minimal motion blur',
      hookPayoffCta: 'hook → proof → payoff → CTA',
    },
    remixPlan: {
      title: 'Reference-safe remix plan',
      hook: 'Lead with a strong contrast angle that frames the problem in under 2 seconds.',
      beatPlan: ['Open on a clean reaction shot', 'State the tension plainly', 'Show proof or payoff', 'Close with a single CTA'],
      soundBed: 'Original or licensed sound bed only',
      memeSlot: 'Do not reuse third-party logos or likenesses without consent',
    },
  };
}

function buildGeneratorBrief(mode) {
  const modes = {
    photorealistic: {
      label: 'Photorealistic',
      description: 'Naturalistic motion, realistic depth, cinematic light and subtle texture.',
      guardrail: 'Use approved likenesses and assets only; no impersonation or unauthorized face replication.',
      shotBrief: 'Cinematic close-up with controlled motion, realistic depth, and a natural light pass.',
    },
    cartoon3d: {
      label: '3D Cartoon',
      description: 'Stylized 3D motion with clear shape language, expressive lighting and polished timing.',
      guardrail: 'Use original characters and assets or licensed 3D elements only.',
      shotBrief: 'Big expressive silhouettes, layered depth, punchy color and motion arcs.',
    },
    animation: {
      label: 'Animation',
      description: 'Illustrated character motion with simplified forms and emotional beats.',
      guardrail: 'Use original or licensed assets only; keep all scene composition rights-safe.',
      shotBrief: 'Snappy pacing, readable silhouettes, layered parallax and soft camera movement.',
    },
    sports: {
      label: 'Sports',
      description: 'Fast-paced sports coverage with crowd texture, authentic motion and broadcast-like energy.',
      guardrail: 'Use authorized players, teams and brands only; no fake game footage.',
      shotBrief: 'Close reads, high-speed action framing, crowd ambience, and concise match commentary.',
    },
  };
  return modes[mode] || modes.photorealistic;
}

function serveStaticFile(res, filePath) {
  try {
    const raw = fs.readFileSync(filePath);
    const extension = path.extname(filePath).toLowerCase();
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
    }[extension] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(raw);
  } catch (error) {
    sendJson(res, 404, { error: 'File not found' });
  }
}

function handleApi(req, res) {
  if (!ensureRateLimit(req)) {
    sendJson(res, 429, { error: 'Too many requests. Please slow down.' });
    return;
  }

  applySecurityHeaders(res);

  const url = new URL(req.url, BASE_URL);
  const { pathname } = url;

  if (pathname === '/api/health') {
    const ffmpegOk = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
    sendJson(res, 200, { ok: true, service: 'ClipForge Studio', ffmpegAvailable: ffmpegOk, timestamp: new Date().toISOString() });
    return;
  }

  if (pathname === '/api/session' && req.method === 'GET') {
    const currentUser = getCurrentUser(req);
    sendJson(res, 200, { user: currentUser ? { id: currentUser.id, email: currentUser.email } : null });
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
        sendJson(res, 409, { error: 'A user already exists with that email.' });
        return;
      }
      const user = {
        id: generateId('user'),
        email,
        passwordHash: sha256(password),
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      setUserStore(users);
      const sessionId = generateId('session');
      const sessions = getSessionStore();
      sessions[sessionId] = { userId: user.id, csrfToken: createCsrfToken(), createdAt: new Date().toISOString() };
      setSessionStore(sessions);
      setSessionCookie(res, sessionId);
      sendJson(res, 201, { user: { id: user.id, email: user.email }, csrfToken: sessions[sessionId].csrfToken });
    }).catch((error) => {
      sendJson(res, 400, { error: error.message || 'Unable to sign up.' });
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
      sessions[sessionId] = { userId: user.id, csrfToken: createCsrfToken(), createdAt: new Date().toISOString() };
      setSessionStore(sessions);
      setSessionCookie(res, sessionId);
      sendJson(res, 200, { user: { id: user.id, email: user.email }, csrfToken: sessions[sessionId].csrfToken });
    }).catch((error) => {
      sendJson(res, 400, { error: error.message || 'Unable to log in.' });
    });
    return;
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const session = getSessionFromRequest(req);
    if (session) {
      const sessions = getSessionStore();
      for (const key of Object.keys(sessions)) {
        if (sessions[key].userId === session.userId) delete sessions[key];
      }
      setSessionStore(sessions);
    }
    clearSessionCookie(res);
    sendJson(res, 200, { ok: true, message: 'Signed out.' });
    return;
  }

  if (pathname === '/api/auth/logout-everywhere' && req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const sessions = getSessionStore();
    for (const key of Object.keys(sessions)) {
      if (sessions[key].userId === user.id) delete sessions[key];
    }
    setSessionStore(sessions);
    clearSessionCookie(res);
    sendJson(res, 200, { ok: true, message: 'Signed out everywhere.' });
    return;
  }

  if (pathname === '/api/projects' && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return;
    const projects = getProjectStore().filter((project) => project.userId === user.id);
    sendJson(res, 200, { projects });
    return;
  }

  if (pathname === '/api/projects' && req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    parseBody(req).then((body) => {
      const error = validateProjectInput(body);
      if (error) {
        sendJson(res, 400, { error });
        return;
      }
      const project = {
        id: generateId('project'),
        userId: user.id,
        title: String(body.title).trim(),
        platform: String(body.platform || 'YouTube').trim(),
        status: 'draft',
        rightsConfirmed: Boolean(body.rightsConfirmed),
        ownershipConfirmation: String(body.ownershipConfirmation).trim(),
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
      sendJson(res, 400, { error: error.message || 'Unable to create project.' });
    });
    return;
  }

  if (pathname.startsWith('/api/projects/') && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return;
    const projectId = pathname.split('/')[3];
    const project = getProjectStore().find((item) => item.id === projectId && item.userId === user.id);
    if (!project) {
      sendJson(res, 404, { error: 'Project not found.' });
      return;
    }
    const renders = getRenderStore().filter((item) => item.projectId === project.id);
    sendJson(res, 200, { project, renders });
    return;
  }

  if (pathname.startsWith('/api/projects/') && pathname.includes('/render') && req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const projectId = pathname.split('/')[2];
    const projects = getProjectStore();
    const project = projects.find((item) => item.id === projectId && item.userId === user.id);
    if (!project) {
      sendJson(res, 404, { error: 'Project not found.' });
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

    const renderRecord = createRender(project);
    const renders = getRenderStore();
    renders.unshift(renderRecord);
    setRenderStore(renders);

    project.status = renderRecord.status === 'rendered' ? 'approved' : 'failed';
    project.updatedAt = new Date().toISOString();
    const idx = projects.findIndex((item) => item.id === project.id);
    if (idx >= 0) projects[idx] = project;
    setProjectStore(projects);

    sendJson(res, 200, { ok: true, render: renderRecord, project });
    return;
  }

  if (pathname === '/api/scheduler' && req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    parseBody(req).then((body) => {
      const workflow = {
        id: generateId('workflow'),
        userId: user.id,
        projectId: String(body.projectId || ''),
        cadence: String(body.cadence || 'manual'),
        scheduledAt: body.scheduledAt || new Date().toISOString(),
        autoPublish: Boolean(body.autoPublish),
        status: 'scheduled',
        createdAt: new Date().toISOString(),
      };
      const workflows = getWorkflowStore();
      workflows.push(workflow);
      setWorkflowStore(workflows);
      sendJson(res, 200, { workflow, message: 'Schedule created. Auto-publish remains off by default unless explicitly enabled.' });
    }).catch((error) => {
      sendJson(res, 400, { error: error.message || 'Unable to create schedule.' });
    });
    return;
  }

  if (pathname === '/api/reference/analyze' && req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    parseBody(req).then((body) => {
      sendJson(res, 200, buildReferenceProfile(body || {}));
    }).catch((error) => {
      sendJson(res, 400, { error: error.message || 'Reference analysis failed.' });
    });
    return;
  }

  if (pathname === '/api/generator/brief' && req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    parseBody(req).then((body) => {
      const mode = String(body.mode || 'photorealistic');
      sendJson(res, 200, { mode, brief: buildGeneratorBrief(mode) });
    }).catch((error) => {
      sendJson(res, 400, { error: error.message || 'Generator brief failed.' });
    });
    return;
  }

  if (pathname.startsWith('/api/connect/') && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return;
    const platform = pathname.split('/')[3];
    const mockAuthUrl = `${BASE_URL}/api/connect/${platform}/callback?code=mock_${platform}_code&userId=${user.id}`;
    sendJson(res, 200, { platform, authUrl: mockAuthUrl, status: 'mock_connect_ready' });
    return;
  }

  if (pathname.startsWith('/api/connect/') && pathname.endsWith('/callback') && req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const platform = pathname.split('/')[3];
    parseBody(req).then((body) => {
      const store = getPlatformStore();
      store[platform] = {
        connected: true,
        userId: user.id,
        accountName: body.accountName || `${platform} creator`,
        accessToken: `mock_${platform}_token`,
        connectedAt: new Date().toISOString(),
      };
      setPlatformStore(store);
      sendJson(res, 200, { ok: true, platform, account: store[platform].accountName });
    }).catch((error) => {
      sendJson(res, 400, { error: error.message || 'Unable to connect account.' });
    });
    return;
  }

  if (pathname === '/api/platforms' && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return;
    const platforms = getPlatformStore();
    const userPlatforms = Object.fromEntries(Object.entries(platforms).filter(([, value]) => value.userId === user.id));
    sendJson(res, 200, { platforms: userPlatforms });
    return;
  }

  if (pathname === '/api/media' && req.method === 'GET') {
    const file = path.join(DATA_DIR, 'media.json');
    sendJson(res, 200, { media: fs.existsSync(file) ? readJson(file, []) : [] });
    return;
  }

  if (pathname.startsWith('/api/media/') && req.method === 'GET') {
    const renderFile = path.join(DATA_DIR, path.basename(pathname));
    if (fs.existsSync(renderFile)) {
      serveStaticFile(res, renderFile);
      return;
    }
    sendJson(res, 404, { error: 'Media not found.' });
    return;
  }

  if (pathname === '/manus-routes.json') {
    serveStaticFile(res, path.join(__dirname, 'manus-routes.json'));
    return;
  }

  sendJson(res, 404, { error: 'Not found.' });
}

function handleStatic(req, res) {
  const url = new URL(req.url, BASE_URL);
  const pathname = url.pathname;

  if (pathname === '/' || pathname === '/index.html') {
    serveStaticFile(res, path.join(PUBLIC_DIR, 'index.html'));
    return;
  }

  if (pathname === '/app' || pathname === '/app.html') {
    serveStaticFile(res, path.join(PUBLIC_DIR, 'app.html'));
    return;
  }

  const candidate = path.join(PUBLIC_DIR, pathname.replace(/^\/+/, ''));
  if (candidate.startsWith(PUBLIC_DIR) && fs.existsSync(candidate)) {
    serveStaticFile(res, candidate);
    return;
  }

  serveStaticFile(res, path.join(PUBLIC_DIR, 'index.html'));
}

const server = http.createServer((req, res) => {
  applySecurityHeaders(res);
  const url = new URL(req.url, BASE_URL);

  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res);
    return;
  }

  if ([ '/', '/app', '/index.html', '/app.html', '/styles.css', '/app.js', '/favicon.ico' ].includes(url.pathname) || url.pathname.endsWith('.css') || url.pathname.endsWith('.js') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.png') || url.pathname.endsWith('.jpg') || url.pathname.endsWith('.jpeg') || url.pathname.endsWith('.webp') || url.pathname.endsWith('.ico')) {
    handleStatic(req, res);
    return;
  }

  handleStatic(req, res);
});

ensureStorage();
server.listen(PORT, HOST, () => {
  console.log(`ClipForge Studio production server running at http://${HOST}:${PORT}`);
});
