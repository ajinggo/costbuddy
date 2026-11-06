// Browser regression: serve this directory on port 8877 and open it in Chrome with CDP on 9227.
// Dedicated test origin only; never use the active preview port 8876. This clears test-origin storage.
const pages = await (await fetch('http://127.0.0.1:9227/json')).json();
const ws = new WebSocket(pages.find(page => page.type === 'page' && page.url.includes('127.0.0.1:8877')).webSocketDebuggerUrl);
await new Promise(resolve => ws.onopen = resolve);
let id = 0;
const pending = new Map();
ws.onmessage = event => { const message = JSON.parse(event.data); if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); } };
const send = (method, params = {}) => new Promise(resolve => { const next = ++id; pending.set(next, resolve); ws.send(JSON.stringify({ id: next, method, params })); });
const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.result.value;
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:8877/welcome.html' });
await new Promise(resolve => setTimeout(resolve, 1000));
await evaluate('document.querySelector("#announcementDialog")?.close()');





const check=(ok,msg)=>{if(!ok){ws.close();throw Error(msg)}};
await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
await evaluate(`document.querySelector('.hero-actions a[href="index.html"]').click()`);
await new Promise(r=>setTimeout(r,800));
await evaluate(`document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.getElementById('announcementButton').click()`);
check(await evaluate(`document.querySelector('#announcementDialog time')?.dateTime==='2026-11-03'`),'announcement date missing after landing-page navigation');
check(await evaluate(`!!document.getElementById('cnNoteTrigger')`),'A-share info button missing');
await evaluate(`document.getElementById('cnNoteTrigger').click()`);
check(await evaluate(`getComputedStyle(document.getElementById('cnMarketNote')).display!=='none'`),'A-share note does not expand');
console.log('PASS landing page to calculator to dated announcement and A-share note');ws.close();
