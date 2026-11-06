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
await evaluate('document.querySelectorAll("dialog[open]").forEach(d=>d.close())');
await set({currentShares:100,currentCost:20,marketPrice:20,buyShares:0,sellShares:0});
check(await evaluate('!!document.getElementById("simulationRange")'),'simulation missing');
const before=await evaluate('JSON.stringify({...localStorage})');
await evaluate(`document.querySelectorAll('[data-simulation-change]')[3].click()`);
check(await evaluate(`document.getElementById('simulationPnl').textContent.includes('200.00')`),'preset P&L');
check(before===await evaluate('JSON.stringify({...localStorage})'),'preset changed saved data');
for(const width of [1440,1280,390]) {
 await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
 if(width<600)await evaluate('document.querySelector("[data-mobile-page-target=results]").click()');
 await new Promise(r=>setTimeout(r,250));
 await evaluate('document.getElementById("simulationRange").scrollIntoView({block:"center"})');
 const rect=await evaluate('(()=>{let r=document.getElementById("simulationRange").getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()');
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:rect.x+rect.w*.7,y:rect.y+rect.h/2,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x+rect.w*.85,y:rect.y+rect.h/2,button:'left',buttons:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:rect.x+rect.w*.85,y:rect.y+rect.h/2,button:'left',clickCount:1});
 check(await evaluate('Number(document.getElementById("simulationRange").value)>24'),'drag failed');
 check(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'horizontal overflow');
 await evaluate('scrollTo(0,0)');
 const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});(await import('node:fs')).writeFileSync('/tmp/costbuddy-simulation-'+width+'.png',Buffer.from(shot.result.data,'base64'));
}
await evaluate('document.getElementById("resultShareButton").click()');
check(await evaluate('document.getElementById("shareCardDialog").open'),'share failed');
await evaluate('document.getElementById("shareCardDialog").close()');
await set({currentShares:0});check(await evaluate('document.getElementById("simulationRange").disabled'),'invalid not disabled');
console.log('PASS presets, real mouse drag at 1440/1280/390, isolated storage, no overflow, sharing, invalid state');ws.close();