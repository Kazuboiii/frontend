const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const axios = require('axios');

function load(env = {}, initial = {}) {
  const storage = new Map(Object.entries({ auth_api_base: env.NEXT_PUBLIC_API_BASE_URL || "/api/v1", ...initial }));
  const localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) };
  const clients = [];
  const wrapped = Object.assign({}, axios, { create(options) { const client = axios.create(options); clients.push(client); return client; } });
  wrapped.default = wrapped;
  const module = { exports: {} };
  const window = { location: { pathname: '/dashboard', href: '' } };
  const source = ts.transpileModule(fs.readFileSync('lib/api.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(source, { require: () => wrapped, module, exports: module.exports, process: { env }, localStorage, window, URL });
  return { ...module.exports, clients, storage, window };
}
function ok(config, data) { return { config, data, status: 200, statusText: 'OK', headers: {} }; }
function fail(config, status) { throw new axios.AxiosError('Denied', 'ERR_BAD_REQUEST', config, null, { config, status, data: {} }); }

test('deployment URLs and stale browser overrides', () => {
  for (const base of ['http://localhost:8000', 'https://backend-test.onrender.com', 'https://backend-test.onrender.com/api/v1/']) {
    const c = load({ NEXT_PUBLIC_API_BASE_URL: base }, { api_base_url: 'http://stale:8000' });
    assert.equal(c.getApiBase(), base.replace(/\/+$/, '').endsWith('/api/v1') ? base.replace(/\/+$/, '') : base + '/api/v1');
  }
  assert.equal(load().getApiBase(), '/api/v1');
  assert.equal(load({}, { api_base_url: 'http://stale:8000' }).getApiBase(), '/api/v1');
  assert.equal(load({ NEXT_PUBLIC_ALLOW_API_OVERRIDE: 'true' }, { api_base_url: 'http://localhost:8000/api/v1' }).getApiBase(), 'http://localhost:8000/api/v1');
  assert.throws(() => load({ NEXT_PUBLIC_API_BASE_URL: 'javascript:alert(1)' }));
});
test('parallel expired requests share refresh and retry', async () => {
  const c = load({}, { access_token: 'old', refresh_token: 'refresh' });
  let refreshes = 0;
  c.clients[0].defaults.adapter = async config => config.headers.Authorization === 'Bearer new' ? ok(config, { id: 1 }) : fail(config, 401);
  c.clients[1].defaults.adapter = async config => { refreshes++; await new Promise(r => setTimeout(r, 10)); return ok(config, { access: 'new' }); };
  await Promise.all([c.api.get('/auth/me/'), c.api.get('/inventory/products/')]);
  assert.equal(refreshes, 1);
  assert.equal(c.storage.get('access_token'), 'new');
});
test('expired refresh clears session; network error preserves it', async () => {
  for (const status of [401, 503]) {
    const c = load({}, { access_token: 'old', refresh_token: 'refresh', user: '{}' });
    c.clients[0].defaults.adapter = async config => fail(config, 401);
    c.clients[1].defaults.adapter = async config => fail(config, status);
    await assert.rejects(c.api.get('/auth/me/'));
    assert.equal(c.storage.has('refresh_token'), status === 503);
    assert.equal(c.window.location.href, status === 401 ? '/login' : '');
  }
});
test('invalid login does not refresh or send stale bearer', async () => {
  const c = load({}, { access_token: 'old', refresh_token: 'refresh' });
  c.clients[0].defaults.adapter = async config => { assert.equal(config.headers.Authorization, undefined); return fail(config, 401); };
  c.clients[1].defaults.adapter = async () => assert.fail('unexpected refresh');
  await assert.rejects(c.api.post('/auth/login/', {}));
});
test('logout during refresh cannot resurrect session', async () => {
  const c = load({}, { access_token: 'old', refresh_token: 'refresh' });
  c.clients[0].defaults.adapter = async config => fail(config, 401);
  c.clients[1].defaults.adapter = async config => { c.storage.delete('refresh_token'); c.storage.delete('access_token'); return ok(config, { access: 'new' }); };
  await assert.rejects(c.api.get('/auth/me/'));
  assert.equal(c.storage.has('access_token'), false);
});

test('tokens are never forwarded to a changed backend', async () => {
  const c = load({ NEXT_PUBLIC_API_BASE_URL: 'https://different.example/api/v1' }, {
    access_token: 'old', refresh_token: 'refresh', auth_api_base: 'https://original.example/api/v1'
  });
  c.clients[0].defaults.adapter = async () => assert.fail('token forwarded');
  await assert.rejects(c.api.get('/auth/me/'));
  assert.equal(c.storage.has('access_token'), false);
});

test('forbidden access never refreshes or logs out', async () => {
  const c = load({}, { access_token: 'valid', refresh_token: 'refresh' });
  c.clients[0].defaults.adapter = async config => fail(config, 403);
  c.clients[1].defaults.adapter = async () => assert.fail('unexpected refresh');
  await assert.rejects(c.api.get('/inventory/products/'));
  assert.equal(c.storage.get('access_token'), 'valid');
});
test('a rejected retry ends the session without a refresh loop', async () => {
  const c = load({}, { access_token: 'old', refresh_token: 'refresh' });
  let refreshes = 0;
  c.clients[0].defaults.adapter = async config => fail(config, 401);
  c.clients[1].defaults.adapter = async config => { refreshes++; return ok(config, { access: 'new' }); };
  await assert.rejects(c.api.get('/auth/me/'));
  assert.equal(refreshes, 1);
  assert.equal(c.storage.has('access_token'), false);
});
