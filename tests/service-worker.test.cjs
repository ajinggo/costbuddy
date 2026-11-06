const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

function createServiceWorker({ cachedNavigation, networkResponse, networkFails = false }) {
  const listeners = new Map();
  const puts = [];
  const cache = {
    addAll: async () => {},
    put: async (...args) => puts.push(args),
  };
  const caches = {
    open: async () => cache,
    match: async request => request === '/' || request.url === 'https://costbuddy.space/' ? cachedNavigation : null,
  };
  const context = {
    caches,
    fetch: async () => {
      if (networkFails) throw new Error('offline');
      return networkResponse;
    },
    self: { addEventListener: (name, listener) => listeners.set(name, listener), skipWaiting: async () => {}, clients: { claim: async () => {} } },
    console,
  };
  vm.runInNewContext(fs.readFileSync(new URL('../sw.js', `file://${__filename}`), 'utf8'), context);
  return { listeners, puts };
}

test('navigation requests use the deployed page instead of a stale cached homepage', async () => {
  const cachedNavigation = { body: 'old page' };
  const networkResponse = { status: 200, type: 'basic', body: 'new page', clone() { return this; } };
  const { listeners, puts } = createServiceWorker({ cachedNavigation, networkResponse });
  let response;
  listeners.get('fetch')({
    request: { mode: 'navigate', url: 'https://costbuddy.space/', clone() { return this; } },
    respondWith: promise => { response = promise; },
  });
  assert.equal(await response, networkResponse);
});
