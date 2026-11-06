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
for(const [scenario,value] of [['buy','93.37'],['sell','95.06'],['round','96.10']]) {
 await evaluate(`document.querySelector('[data-scenario=${scenario}]').click()`);
 check(await evaluate(`document.getElementById('demo-result').textContent`)===value,'incorrect demo '+scenario);
}
await evaluate(`document.getElementById('tab-buy').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`);
check(await evaluate(`document.getElementById('tab-sell').getAttribute('aria-selected')==='true'`),'keyboard tabs');
for(const width of [1440,1024,768,390,375]) {
 await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
 await evaluate(`document.querySelectorAll('[data-reveal]').forEach(n=>n.classList.add('is-visible'));scrollTo(0,0)`);
 await new Promise(r=>setTimeout(r,800));
 check(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'overflow '+width);
 check(await evaluate(`Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)`),'missing image');
 const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});(await import('node:fs')).writeFileSync('/tmp/costbuddy-welcome-'+width+'.png',Buffer.from(shot.result.data,'base64'));
}
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
check(await evaluate(`getComputedStyle(document.querySelector('[data-reveal]')).opacity==='1'`),'reduced motion hides content');
check(await evaluate(`getComputedStyle(document.getElementById('result-bar')).transitionDuration==='0s'`),'reduced motion active');
check(await evaluate(`Array.from(document.querySelectorAll('a[href="index.html"]')).length>=3`),'calculator links');
await send('Emulation.setEmulatedMedia',{features:[]});
console.log('PASS demo formulas, keyboard tabs, five widths, images, reduced motion and calculator links');ws.close();
