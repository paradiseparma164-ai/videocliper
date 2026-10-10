const authView = document.getElementById('authView');
const appView = document.getElementById('appView');
const authForm = document.getElementById('authForm');
const authMessage = document.getElementById('authMessage');
const showLoginBtn = document.getElementById('showLogin');
const showSignupBtn = document.getElementById('showSignup');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const submitAuth = document.getElementById('submitAuth');

const projectList = document.getElementById('projectList');
const projectCount = document.getElementById('projectCount');
const reviewCount = document.getElementById('reviewCount');
const scheduledCount = document.getElementById('scheduledCount');
const platformCount = document.getElementById('platformCount');
const welcomeTitle = document.getElementById('welcomeTitle');

let authMode = 'login';
let csrfToken = '';
let currentUser = null;

function setMessage(element, text, type = 'info') {
  element.textContent = text;
  element.classList.remove('hidden');
  element.classList.remove('success', 'error');
  if (type === 'success') element.classList.add('success');
  if (type === 'error') element.classList.add('error');
}

function clearMessage(element) {
  element.textContent = '';
  element.classList.add('hidden');
}

async function apiRequest(url, options = {}) {
  const headers = options.headers || {};
  headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  if (csrfToken) headers['x-csrf-token'] = csrfToken;
  const response = await fetch(url, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(payload.error || payload || 'Request failed');
  }
  return payload;
}

async function checkSession() {
  try {
    const session = await apiRequest('/api/session');
    if (session.user) {
      currentUser = session.user;
      welcomeTitle.textContent = `Welcome, ${session.user.email}`;
      authView.classList.add('hidden');
      appView.classList.remove('hidden');
      loadProjects();
      loadPlatforms();
    } else {
      currentUser = null;
      authView.classList.remove('hidden');
      appView.classList.add('hidden');
    }
  } catch (error) {
    authView.classList.remove('hidden');
    appView.classList.add('hidden');
  }
}

function setAuthMode(mode) {
  authMode = mode;
  showLoginBtn.classList.toggle('active', mode === 'login');
  showSignupBtn.classList.toggle('active', mode === 'signup');
  submitAuth.textContent = mode === 'login' ? 'Sign in' : 'Create account';
}

showLoginBtn.addEventListener('click', () => setAuthMode('login'));
showSignupBtn.addEventListener('click', () => setAuthMode('signup'));

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage(authMessage);
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  try {
    const path = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
    const data = await apiRequest(path, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    csrfToken = data.csrfToken || '';
    currentUser = data.user;
    welcomeTitle.textContent = `Welcome, ${currentUser.email}`;
    authView.classList.add('hidden');
    appView.classList.remove('hidden');
    loadProjects();
    loadPlatforms();
    emailInput.value = '';
    passwordInput.value = '';
  } catch (error) {
    setMessage(authMessage, error.message, 'error');
  }
});

async function loadProjects() {
  try {
    const data = await apiRequest('/api/projects');
    const projects = data.projects || [];
    projectCount.textContent = String(projects.length);
    reviewCount.textContent = String(projects.filter((p) => p.status === 'ready_for_review' || p.status === 'approved').length);
    scheduledCount.textContent = String(projects.filter((p) => p.status === 'scheduled').length);

    if (!projects.length) {
      projectList.innerHTML = '<div class="item">No projects yet. Create one on the left.</div>';
      return;
    }

    projectList.innerHTML = projects.map((project) => `
      <div class="item">
        <strong>${project.title}</strong>
        <div>Platform: ${project.platform}</div>
        <div>Rights: ${project.rightsConfirmed ? 'confirmed' : 'missing'}</div>
        <span class="status ${project.status === 'approved' ? 'approved' : project.status === 'failed' ? 'failed' : 'draft'}">${project.status || 'draft'}</span>
        <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
          <button type="button" data-render-id="${project.id}">Render</button>
        </div>
      </div>
    `).join('');

    projectList.querySelectorAll('[data-render-id]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          const result = await apiRequest(`/api/projects/${button.dataset.renderId}/render`, { method: 'POST', body: JSON.stringify({}) });
          setMessage(document.getElementById('platformOutput'), `Render status: ${result.render.status} — ${result.render.message}`, result.render.status === 'rendered' ? 'success' : 'error');
          loadProjects();
        } catch (error) {
          setMessage(document.getElementById('platformOutput'), error.message, 'error');
        }
      });
    });
  } catch (error) {
    console.error(error);
  }
}

async function loadPlatforms() {
  try {
    const data = await apiRequest('/api/platforms');
    const count = Object.keys(data.platforms || {}).length;
    platformCount.textContent = String(count);
  } catch (error) {
    platformCount.textContent = '0';
  }
}

document.getElementById('createProjectBtn').addEventListener('click', async () => {
  const title = document.getElementById('projectTitle').value.trim();
  const platform = document.getElementById('projectPlatform').value.trim();
  const rights = document.getElementById('projectRights').value.trim();
  const rightsConfirmed = document.getElementById('rightsConfirmed').checked;
  const musicTitle = document.getElementById('musicTitle').value.trim();
  const musicLicense = document.getElementById('musicLicense').value.trim();
  const musicPermission = document.getElementById('musicPermission').checked;

  try {
    await apiRequest('/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        title,
        platform,
        ownershipConfirmation: rights,
        rightsConfirmed,
        musicTitle,
        musicLicense,
        musicPermission,
      }),
    });
    document.getElementById('projectTitle').value = '';
    document.getElementById('projectPlatform').value = '';
    document.getElementById('projectRights').value = '';
    document.getElementById('rightsConfirmed').checked = false;
    document.getElementById('musicTitle').value = '';
    document.getElementById('musicLicense').value = '';
    document.getElementById('musicPermission').checked = false;
    loadProjects();
  } catch (error) {
    setMessage(document.getElementById('platformOutput'), error.message, 'error');
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    csrfToken = '';
    checkSession();
  } catch (error) {
    console.error(error);
  }
});

document.getElementById('logoutEverywhereBtn').addEventListener('click', async () => {
  try {
    await apiRequest('/api/auth/logout-everywhere', { method: 'POST' });
    currentUser = null;
    csrfToken = '';
    checkSession();
  } catch (error) {
    console.error(error);
  }
});

document.getElementById('analyzeReferenceBtn').addEventListener('click', async () => {
  const source = document.getElementById('refSource').value.trim();
  const output = document.getElementById('referenceOutput');
  try {
    const result = await apiRequest('/api/reference/analyze', {
      method: 'POST',
      body: JSON.stringify({ source, style: 'creator-led storytelling' }),
    });
    output.textContent = JSON.stringify(result, null, 2);
    output.classList.remove('hidden');
    output.classList.add('success');
  } catch (error) {
    output.textContent = error.message;
    output.classList.remove('hidden');
    output.classList.add('error');
  }
});

document.getElementById('generatorBriefBtn').addEventListener('click', async () => {
  const mode = document.getElementById('generatorMode').value;
  const output = document.getElementById('generatorOutput');
  try {
    const result = await apiRequest('/api/generator/brief', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
    output.textContent = `${result.brief.label}: ${result.brief.description} Guardrail: ${result.brief.guardrail}`;
    output.classList.remove('hidden');
    output.classList.add('success');
  } catch (error) {
    output.textContent = error.message;
    output.classList.remove('hidden');
    output.classList.add('error');
  }
});

document.getElementById('connectYoutube').addEventListener('click', async () => {
  const output = document.getElementById('platformOutput');
  try {
    const result = await apiRequest('/api/connect/youtube', { method: 'GET' });
    output.textContent = `YouTube mock connect ready: ${result.authUrl}`;
    output.classList.remove('hidden');
    output.classList.add('success');
    await apiRequest('/api/connect/youtube/callback', {
      method: 'POST',
      body: JSON.stringify({ accountName: 'ClipForge Creator' }),
    });
  } catch (error) {
    output.textContent = error.message;
    output.classList.remove('hidden');
    output.classList.add('error');
  }
});

document.getElementById('connectTikTok').addEventListener('click', async () => {
  const output = document.getElementById('platformOutput');
  try {
    const result = await apiRequest('/api/connect/tiktok', { method: 'GET' });
    output.textContent = `TikTok mock connect ready: ${result.authUrl}`;
    output.classList.remove('hidden');
    output.classList.add('success');
    await apiRequest('/api/connect/tiktok/callback', {
      method: 'POST',
      body: JSON.stringify({ accountName: 'TikTok Creator' }),
    });
  } catch (error) {
    output.textContent = error.message;
    output.classList.remove('hidden');
    output.classList.add('error');
  }
});

document.getElementById('connectInstagram').addEventListener('click', async () => {
  const output = document.getElementById('platformOutput');
  try {
    const result = await apiRequest('/api/connect/instagram', { method: 'GET' });
    output.textContent = `Instagram mock connect ready: ${result.authUrl}`;
    output.classList.remove('hidden');
    output.classList.add('success');
    await apiRequest('/api/connect/instagram/callback', {
      method: 'POST',
      body: JSON.stringify({ accountName: 'Instagram Creator' }),
    });
  } catch (error) {
    output.textContent = error.message;
    output.classList.remove('hidden');
    output.classList.add('error');
  }
});

setAuthMode('login');
checkSession();
