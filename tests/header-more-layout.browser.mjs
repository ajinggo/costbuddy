// Regression: on mobile, opening More must push the page switcher down instead of covering it.
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
await send('Page.navigate', { url: 'http://127.0.0.1:8878/index.html?header-more-regression=1' });
await new Promise(resolve => setTimeout(resolve, 600));
const mobile = await evaluate(`(() => {
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  const details = document.getElementById('headerMore');
  details.open = true;
  const panel = details.querySelector('.header-more-panel').getBoundingClientRect();
  const summary = details.querySelector('summary').getBoundingClientRect();
  const nav = document.querySelector('.mobile-page-switcher').getBoundingClientRect();
  const form = document.querySelector('.sidebar-column').getBoundingClientRect();
  return {panelTop: panel.top, panelBottom: panel.bottom, summaryBottom: summary.bottom,
    navTop: nav.top, navBottom: nav.bottom, formTop: form.top,
    position: getComputedStyle(details.querySelector('.header-more-panel')).position,
    backdrop: getComputedStyle(document.body, '::before').position === 'fixed',
    overflow: document.documentElement.scrollWidth > innerWidth};
})()`);
check(mobile.position === 'absolute' && mobile.panelTop >= mobile.summaryBottom - 1,
  'Mobile More panel should float below its trigger: ' + JSON.stringify(mobile));
check(mobile.backdrop, 'Mobile More menu should display a dismissible backdrop.');
check(!mobile.overflow, 'Mobile More menu should not introduce horizontal overflow.');
const dismissed = await evaluate(`(() => {
  document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return !document.getElementById('headerMore').open;
})()`);
check(dismissed, 'Clicking outside the floating More menu should close it.');
await evaluate(`document.getElementById('headerMore').open = true`);
const fs = await import('node:fs');
const mobileShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
fs.writeFileSync('/tmp/costbuddy-header-more-mobile.png', Buffer.from(mobileShot.result.data, 'base64'));

await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
const desktop = await evaluate(`(() => {
  const details = document.getElementById('headerMore');
  details.open = true;
  return {position: getComputedStyle(details.querySelector('.header-more-panel')).position,
    header: document.querySelector('.app-header').getBoundingClientRect(),
    panel: details.querySelector('.header-more-panel').getBoundingClientRect()};
})()`);
check(desktop.position === 'absolute', 'Desktop More menu should retain its anchored dropdown layout.');
await evaluate(`document.getElementById('headerMore').open = false`);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
console.log('PASS mobile More menu floats below its trigger with a dismissible backdrop; desktop dropdown remains anchored.');
ws.close();
