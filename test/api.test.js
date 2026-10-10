const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

function request(path, method = 'GET', body) {
  return new Promise((resolve, reject) => {
    const headers = { Accept: 'application/json' };
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          const parsed = raw ? JSON.parse(raw) : {};
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (error) {
          resolve({ status: res.statusCode, data: raw, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test('marketing page is served', async () => {
  const response = await request('/');
  assert.equal(response.status, 200);
  assert.ok(response.data.includes('ClipForge Studio') || response.data.includes('rights-safe'));
});

test('studio page is served', async () => {
  const response = await request('/app');
  assert.equal(response.status, 200);
});

test('new user can sign up', async () => {
  const email = `tester_${Date.now()}@example.com`;
  const response = await request('/api/auth/signup', 'POST', { email, password: 'secret123' });
  assert.equal(response.status, 201);
  assert.ok(response.data.user && response.data.user.email === email);
});

test('project creation requires rights confirmation', async () => {
  const email = `rights_${Date.now()}@example.com`;
  let signup = await request('/api/auth/signup', 'POST', { email, password: 'secret123' });
  const cookie = signup.headers['set-cookie'][0].split(';')[0];
  const create = await request('/api/projects', 'POST', {
    title: 'Test project',
    platform: 'YouTube',
    ownershipConfirmation: 'I own the footage',
    rightsConfirmed: false,
  });
  assert.equal(create.status, 400);
  assert.ok(String(create.data.error).includes('without explicit ownership confirmation'));
});
