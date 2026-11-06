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





await evaluate('if(document.documentElement.dataset.theme==="dark")document.getElementById("themeToggleButton").click()');

await evaluate(`document.getElementById('currentShares').value=100;document.getElementById('currentCost').value=20;document.getElementById('currentShares').dispatchEvent(new Event('input',{bubbles:true}))`);
const check=(ok,msg)=>{if(!ok){ws.close();throw Error(msg)}};
await evaluate('document.querySelectorAll("dialog[open]").forEach(d=>d.close());document.getElementById("sharePlanButton").click()');
check(await evaluate('document.getElementById("shareCardDialog").open'),'share dialog missing');
check(await evaluate('!document.querySelector("#shareCardDialog canvas").dataset.rowLabels.includes("数量")'),'quantity not private');
check(await evaluate('!document.querySelector("#shareCardDialog canvas").dataset.rowLabels.includes("手续费")'),'amounts not private');
await evaluate('document.getElementById("shareShowQuantity").click();document.getElementById("shareShowAmounts").click()');
check(await evaluate('document.querySelector("#shareCardDialog canvas").dataset.rowLabels.includes("手续费")'),'privacy toggle failed');
const data=await evaluate('document.querySelector("#shareCardDialog canvas").toDataURL("image/png")');(await import('node:fs')).writeFileSync('/tmp/costbuddy-share-card.png',Buffer.from(data.split(',')[1],'base64'));
await evaluate('window.downloads=0;document.addEventListener("click",e=>{if(e.target.closest("a[download]")){e.preventDefault();window.downloads++}},true);document.getElementById("shareSaveImage").click()');
await new Promise(r=>setTimeout(r,400));check(await evaluate('window.downloads===1 && !!document.querySelector(".share-save-preview")'),'PNG export failed');
console.log(await evaluate(`({labels:document.querySelector('#shareCardDialog canvas').dataset.rowLabels,script:document.querySelector('script[src*=share-card]').src})`));const oldImage=await evaluate(`document.querySelector('.share-save-preview').src`);
await evaluate(`document.getElementById('shareShowQuantity').click();document.getElementById('shareShowAmounts').click()`);
check(await evaluate(`document.querySelector('.share-save-preview').src === document.querySelector('#shareCardDialog canvas').toDataURL('image/png')`),'saved preview retains private data after toggling off');
check(oldImage!==await evaluate(`document.querySelector('.share-save-preview').src`),'image did not refresh');
console.log('PASS saved image follows privacy options');ws.close();
