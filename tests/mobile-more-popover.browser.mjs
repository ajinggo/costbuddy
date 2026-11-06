// Mobile More popover should float above the sticky switcher and close on outside click.
const targets = await (await fetch('http://127.0.0.1:9227/json')).json();
const target = targets.find(item => item.type === 'page');
if (!target) throw new Error('Chrome DevTools page target is unavailable.');
const ws = new WebSocket(target.webSocketDebuggerUrl);
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
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.result.value;
};
const check = (condition, message) => { if (!condition) throw new Error(message); };

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: 'http://127.0.0.1:8879/index.html?mobile-more-popover=1' });
await new Promise(resolve => setTimeout(resolve, 700));
const mobile = await evaluate(`(() => {
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  const menu = document.querySelector('.more-menu');
  menu.open = true;
  const summary = menu.querySelector('summary').getBoundingClientRect();
  const panel = menu.querySelector('.more-menu-panel').getBoundingClientRect();
  return {panelTop: panel.top, triggerBottom: summary.bottom,
    position: getComputedStyle(menu.querySelector('.more-menu-panel')).position,
    maxHeight: parseFloat(getComputedStyle(menu.querySelector('.more-menu-panel')).maxHeight),
    backdrop: getComputedStyle(document.body, '::before').position === 'fixed',
    overflow: document.documentElement.scrollWidth > innerWidth};
})()`);
check(mobile.position === 'absolute' && mobile.panelTop >= mobile.triggerBottom - 1,
  'Mobile More menu should float from its trigger: ' + JSON.stringify(mobile));
check(mobile.backdrop && mobile.maxHeight > 0, 'Floating menu should have a backdrop and bounded scrolling area.');
check(!mobile.overflow, 'Floating menu must not introduce horizontal overflow.');
const closed = await evaluate(`(() => {
  document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return !document.querySelector('.more-menu').open;
})()`);
check(closed, 'Clicking outside the More menu should close it.');

await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
const desktop = await evaluate(`(() => {
  const menu = document.querySelector('.more-menu'); menu.open = true;
  return getComputedStyle(menu.querySelector('.more-menu-panel')).position;
})()`);
check(desktop === 'absolute', 'Desktop More menu should remain an anchored dropdown.');
await evaluate(`document.querySelector('.more-menu').open = false`);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
console.log('PASS mobile More popover, backdrop dismissal, bounded panel and desktop dropdown.');
ws.close();
