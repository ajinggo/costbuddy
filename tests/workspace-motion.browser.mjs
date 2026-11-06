// Browser regression for calculator feedback motion. Uses the isolated 8878 test origin.
const pages = await (await fetch('http://127.0.0.1:9227/json')).json();
const page = pages.find(item => item.type === 'page');
if (!page) throw new Error('Chrome DevTools page target is unavailable.');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => ws.onopen = resolve);
let id = 0;
const pending = new Map();
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
};
const send = (method, params = {}) => new Promise(resolve => {
  const next = ++id;
  pending.set(next, resolve);
  ws.send(JSON.stringify({ id: next, method, params }));
});
const evaluate = async expression => {
  const response = await send('Runtime.evaluate', {
  expression,
  returnByValue: true,
  awaitPromise: true
  });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text + ': ' + (response.exceptionDetails.exception?.description || ''));
  if (!response.result.result) throw new Error('Unexpected Runtime.evaluate result: ' + JSON.stringify(response));
  if (expression.startsWith('(() =>') && response.result.result.value === undefined) throw new Error('Evaluation returned undefined: ' + JSON.stringify(response));
  return response.result.result.value;
};
const check = (condition, message) => { if (!condition) throw new Error(message); };
const activeAnimations = `element => element ? element.getAnimations().filter(animation => animation.playState === 'running' || animation.playState === 'pending').length : 0`;

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:8878/index.html' });
await new Promise(resolve => setTimeout(resolve, 800));
await evaluate('localStorage.clear(); sessionStorage.clear(); location.reload()');
await new Promise(resolve => setTimeout(resolve, 800));
await evaluate('document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close())');

const updated = await evaluate(`(() => {
  const cost = document.getElementById('newDilutedCost');
  document.getElementById('sellShares').value = '0';
  document.getElementById('buyShares').value = '100';
  document.getElementById('buyPrice').value = '20';
  document.getElementById('buyShares').dispatchEvent(new Event('input', { bubbles: true }));
  const active = ${activeAnimations};
  return { cost: cost.textContent, costAnimation: active(cost),
    previewAnimation: active(document.querySelector('.trail-preview-line')),
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
})()`);
check(updated.costAnimation > 0, 'Changed result value should animate briefly.');
check(updated.previewAnimation > 0, 'Updated chart preview should animate briefly.');

const confirmed = await evaluate(`(() => {
  const button = document.getElementById('confirmCostTrail');
  const wasEnabled = !button.disabled;
  button.click();
  const latest = document.querySelector('#chartAnnotations .trail-node:last-of-type');
  const active = ${activeAnimations};
  return { wasEnabled, newNode: latest?.classList.contains('is-new'),
    nodeAnimation: active(latest?.querySelector('.trail-dot')) };
})()`);
check(confirmed.wasEnabled && confirmed.newNode && confirmed.nodeAnimation > 0, 'Confirmed purchase should animate its new chart node: ' + JSON.stringify(confirmed));

await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await new Promise(resolve => setTimeout(resolve, 220));
const reduced = await evaluate(`(() => {
  document.getElementById('sellShares').value = '0';
  document.getElementById('buyShares').value = '100';
  document.getElementById('buyPrice').value = '18';
  document.getElementById('buyShares').dispatchEvent(new Event('input', { bubbles: true }));
  const active = ${activeAnimations};
  return { costAnimations: active(document.getElementById('newDilutedCost')),
    previewAnimations: active(document.querySelector('.trail-preview-line')),
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
})()`);
check(reduced.costAnimations === 0 && reduced.previewAnimations === 0, 'Reduced-motion preference should disable calculator feedback animations: ' + JSON.stringify(reduced));
await send('Emulation.setEmulatedMedia', { features: [] });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await evaluate('localStorage.clear(); sessionStorage.clear(); location.reload()');
await new Promise(resolve => setTimeout(resolve, 800));
await evaluate(`document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close()); document.getElementById('sellShares').value='0'; document.getElementById('buyShares').value='100'; document.getElementById('buyPrice').value='18'; document.getElementById('buyShares').dispatchEvent(new Event('input',{bubbles:true}))`);
const desktop = await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,chart:document.getElementById('costChart').getBoundingClientRect().width})`);
check(!desktop.overflow && desktop.chart > 300, 'Desktop layout should stay visible without horizontal overflow.');
const fs = await import('node:fs');
const desktopShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
fs.writeFileSync('/tmp/costbuddy-motion-desktop.png', Buffer.from(desktopShot.result.data, 'base64'));
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await evaluate(`document.querySelector('[data-mobile-page-target="results"]')?.click()`);
await new Promise(resolve => setTimeout(resolve, 260));
const mobile = await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,chart:document.getElementById('costChart').getBoundingClientRect().width,dialogs:[...document.querySelectorAll('dialog[open]')].map(dialog=>dialog.id)})`);
check(!mobile.overflow && mobile.chart > 0 && mobile.dialogs.length === 0, 'Mobile layout should keep the cost chart visible without horizontal overflow or open dialogs: ' + JSON.stringify(mobile));
const mobileShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
fs.writeFileSync('/tmp/costbuddy-motion-mobile.png', Buffer.from(mobileShot.result.data, 'base64'));
await evaluate('localStorage.clear(); sessionStorage.clear()');
console.log('PASS result updates, chart preview, confirmed node, reduced motion and desktop/mobile layout');
ws.close();
