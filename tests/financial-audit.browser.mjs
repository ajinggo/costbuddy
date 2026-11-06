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
await send('Page.navigate', { url: 'http://127.0.0.1:8877/index.html' });
await new Promise(resolve => setTimeout(resolve, 1000));
await evaluate('document.querySelector("#announcementDialog")?.close()');





const check=(ok,msg)=>{if(!ok){ws.close();throw Error(msg)}};
const set=async obj=>evaluate('Object.entries('+JSON.stringify(obj)+').forEach(([k,v])=>document.getElementById(k).value=v);document.getElementById("currentCost").dispatchEvent(new Event("input",{bubbles:true}))');
await evaluate(`document.querySelectorAll('dialog[open]').forEach(d=>d.close());window.auditErrors=[];window.addEventListener('error',e=>auditErrors.push(e.message))`);
for(const market of ['hk','cn','us']) {
 await evaluate(`document.querySelector('[data-market=${market}]').click()`);
 await set({currentShares:1000,currentCost:20,marketPrice:15,sellShares:100,sellPrice:18,sellFee:5,buyShares:200,buyPrice:10,buyFee:8,lotSize:100,targetCost:17});
 check(await evaluate(`document.getElementById('newDilutedCost').textContent`)==='18.38',market+' incorrect manual cost');
 check(await evaluate(`document.getElementById('totalPnl').textContent.includes('3,713.00')`),market+' incorrect P&L');
 await set({sellShares:0,buyShares:0,sellFee:999,buyFee:999});
 check(await evaluate(`document.getElementById('newDilutedCost').textContent`)==='20.00',market+' zero shares counted fee');
 await set({sellShares:1001});check(await evaluate(`!document.getElementById('validationMessage').hidden`),'oversell accepted');
 await set({sellShares:0,currentShares:1.5});check(await evaluate(`!document.getElementById('validationMessage').hidden`),'fractional holdings accepted');
 await set({currentShares:1000,buyShares:100,buyPrice:10,buyFee:0,targetCost:19.5});
 check(await evaluate(`!document.getElementById('applyTargetPlan').disabled`),'target plan missing');
 await evaluate(`document.getElementById('applyTargetPlan').click()`);
 check(await evaluate(`Number(document.getElementById('newDilutedCost').textContent)<=19.5`),market+' applied plan misses target');
}
check(await evaluate('auditErrors.length===0'),'runtime errors');
console.log('PASS HK/CN/US manual formulas, P&L, unused fees, oversell, fractions, target application; no runtime errors');ws.close();
