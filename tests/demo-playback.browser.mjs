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
await send('Page.enable');await send('Page.bringToFront');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:8877/welcome.html' });
await new Promise(resolve => setTimeout(resolve, 1000));
await evaluate('document.querySelector("#announcementDialog")?.close()');





const check=(ok,msg)=>{if(!ok){ws.close();throw Error(msg)}};
console.log(await evaluate(`({url:location.href,html:document.body.innerHTML.slice(0,100),buttons:document.querySelectorAll('#demoPlay').length})`));check(await evaluate(`!!document.getElementById('demoPlay')`),'play control missing');
await evaluate(`document.documentElement.style.scrollBehavior='auto';document.getElementById('experience').scrollIntoView({behavior:'instant'})`);await new Promise(r=>setTimeout(r,400));await evaluate(`document.getElementById('demoPlay').click()`);
await new Promise(r=>setTimeout(r,1100));
check(await evaluate(`document.getElementById('experience').dataset.playing==='true'`),'not playing');
check(await evaluate(`document.getElementById('tab-buy').getAttribute('aria-selected')==='true'`),'first simulated click failed');
await new Promise(r=>setTimeout(r,2000));
console.log(await evaluate(`({playing:document.getElementById('experience').dataset.playing,selected:document.querySelector('[aria-selected=true]').id,hidden:document.hidden})`));check(await evaluate(`document.getElementById('tab-sell').getAttribute('aria-selected')==='true'`),'second simulated click failed');
await evaluate(`document.getElementById('tab-round').click()`);
check(await evaluate(`document.getElementById('experience').dataset.playing==='false'`),'manual click did not stop');
await new Promise(r=>setTimeout(r,2200));
check(await evaluate(`document.getElementById('demo-result').textContent==='96.10'`),'stale playback overwrote manual choice');
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
await new Promise(r=>setTimeout(r,150));check(await evaluate(`document.getElementById('demoPlay').disabled`),'reduced motion allows playback');
await send('Emulation.setEmulatedMedia',{features:[]});
console.log('PASS simulated clicks, result sequence, manual interruption and reduced motion');ws.close();
