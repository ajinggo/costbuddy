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



const click=id=>evaluate('document.getElementById('+JSON.stringify(id)+').click()');
const set=obj=>evaluate('Object.entries('+JSON.stringify(obj)+').forEach(([k,v])=>document.getElementById(k).value=v);document.getElementById("currentCost").dispatchEvent(new Event("input",{bubbles:true}))');
const load=async id=>{await click('holdingBookButton');await evaluate('Array.from(document.querySelectorAll("[data-record-id]")).find(c=>c.dataset.recordId==='+JSON.stringify(id)+').querySelector("[data-holding-action=load]").click()');if(await evaluate('document.getElementById("unsavedDialog").open'))await click('discardAndContinueButton');};
await evaluate('localStorage.clear();location.reload()');await new Promise(r=>setTimeout(r,600));await evaluate('document.querySelectorAll("dialog[open]").forEach(d=>d.close())');
await set({stockCode:'00700',currentShares:600,currentCost:94,marketPrice:49,sellShares:0,buyShares:0});await click('saveHoldingButton');
const a=await evaluate('localStorage.getItem("hk-diluted-cost-calculator-current-holding-v1")');await click('newMeasurementButton');
await set({stockCode:'00999',currentShares:100,currentCost:10,marketPrice:12,sellShares:0,buyShares:0});await click('saveHoldingButton');
const b=await evaluate('localStorage.getItem("hk-diluted-cost-calculator-current-holding-v1")');await load(a);
await set({buyShares:100,buyPrice:49,buyFee:18.5});await click('confirmCostTrail');
await set({marketPrice:55,buyShares:200,buyPrice:30,buyFee:20,sellPrice:60,sellFee:8,targetCost:70});
await click('scenarioButton');await evaluate('document.querySelector("[data-scenario-action=save][data-slot=A]").click();document.querySelectorAll("dialog[open]").forEach(d=>d.close())');
const expected=await evaluate('JSON.parse(localStorage.getItem("hk-diluted-cost-calculator-v1"))');await load(b);await load(a);
if(await evaluate('document.getElementById("scenarioCount").textContent')!=='1/2')throw Error('scenario lost on switch');
const actual=await evaluate('JSON.parse(localStorage.getItem("hk-diluted-cost-calculator-v1"))');
for(const k of ['stockCode','currentShares','currentCost','marketPrice','buyShares','buyPrice','buyFee','sellShares','sellPrice','sellFee','targetCost','_costTrail','_feeSettings'])if(JSON.stringify(actual[k])!==JSON.stringify(expected[k])){ws.close();throw Error(k+' lost on holding switch');}
await send('Page.reload');await new Promise(r=>setTimeout(r,600));await evaluate('document.querySelectorAll("dialog[open]").forEach(d=>d.close())');await load(b);await load(a);
if(await evaluate('document.getElementById("buyShares").value')!=='200')throw Error('lost on reload');
await click('holdingBookButton');
if(!await evaluate('Boolean(document.getElementById("holdingSearch"))')){ws.close();throw Error('missing holding search');}

const check=(ok,message)=>{if(!ok){ws.close();throw Error(message)}};
const action=(id,kind)=>evaluate('Array.from(document.querySelectorAll("[data-record-id]")).find(c=>c.dataset.recordId==='+JSON.stringify(id)+').querySelector("[data-holding-action='+kind+']").click()');
await evaluate('document.getElementById("holdingSearch").value="007";document.getElementById("holdingSearch").dispatchEvent(new Event("input"))');
check(await evaluate('document.querySelectorAll(".holding-card").length')===1,'search filter failed');
await evaluate('document.getElementById("holdingSearch").value="";document.getElementById("holdingSearch").dispatchEvent(new Event("input"));document.getElementById("holdingMarketFilter").value="us";document.getElementById("holdingMarketFilter").dispatchEvent(new Event("change"))');
check(await evaluate('!document.getElementById("holdingNoMatch").hidden'),'market empty state failed');
await evaluate('document.getElementById("holdingMarketFilter").value="all";document.getElementById("holdingMarketFilter").dispatchEvent(new Event("change"))');
check(await evaluate('document.querySelector(".holding-details").textContent.includes("已确认加仓记录")'),'missing history details');
await action(a,'duplicate');
check(await evaluate('document.querySelectorAll(".holding-card").length')===3,'duplicate failed');
await action(b,'delete');await action(b,'delete');
check(await evaluate('document.querySelectorAll(".holding-card").length')===2,'delete failed');
await click('undoHoldingDelete');
check(await evaluate('document.querySelectorAll(".holding-card").length')===3,'undo failed');
await evaluate('document.querySelector("[data-holding-name]").value="自选名称";document.querySelector("[data-holding-action=rename]").click()');
check(await evaluate('document.getElementById("holdingList").textContent.includes("自选名称")'),'rename failed');
// Build a valid external backup from the complete stored state, then import through the file input.
await evaluate('window.testOriginal=JSON.parse(localStorage.getItem("hk-diluted-cost-calculator-holdings-v1"));window.testCurrent=JSON.parse(localStorage.getItem("hk-diluted-cost-calculator-v1"));window.testBackup={format:"costbuddy-backup",version:2,exportedAt:new Date().toISOString(),data:{current:{values:testCurrent,feeSettings:testCurrent._feeSettings,scenarios:{A:null,B:null},costTrail:testCurrent._costTrail,recordId:null},holdings:[]}};var dt=new DataTransfer();dt.items.add(new File([JSON.stringify(testBackup)],"test.json",{type:"application/json"}));document.getElementById("backupFileInput").files=dt.files;document.getElementById("backupFileInput").dispatchEvent(new Event("change"))');
await new Promise(r=>setTimeout(r,250));await click('confirmImportBackupButton');
check(await evaluate('JSON.parse(localStorage.getItem("hk-diluted-cost-calculator-holdings-v1")).length')===0,'import failed');
await click('restoreHoldingBackup');await click('confirmImportBackupButton');
check(await evaluate('JSON.parse(localStorage.getItem("hk-diluted-cost-calculator-holdings-v1")).length')===3,'restore import failed');
// Simulated storage failure must be visible and recover on retry.
await load(a);await evaluate('window.realSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error("quota")};document.getElementById("marketPrice").value=56;document.getElementById("marketPrice").dispatchEvent(new Event("input",{bubbles:true}))');
check(await evaluate('document.getElementById("saveHoldingLabel").textContent.includes("失败")'),'false saved status');
await evaluate('Storage.prototype.setItem=window.realSetItem;document.getElementById("marketPrice").dispatchEvent(new Event("input",{bubbles:true}))');
check(await evaluate('document.getElementById("saveHoldingLabel").textContent.includes("已保存")'),'save retry failed');
await click('holdingBookButton');await evaluate('document.querySelector(".holding-details").open=true');
const shot=await send('Page.captureScreenshot',{format:'png'});(await import('node:fs')).writeFileSync('/tmp/costbuddy-holding-book.png',Buffer.from(shot.result.data,'base64'));

await evaluate('document.querySelector(".holding-list").scrollTop=250');
const detailShot=await send('Page.captureScreenshot',{format:'png'});(await import('node:fs')).writeFileSync('/tmp/costbuddy-holding-details.png',Buffer.from(detailShot.result.data,'base64'));
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await evaluate('document.querySelector(".holding-list").scrollTop=0');
check(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'mobile page overflow');
check(await evaluate('document.getElementById("holdingBookDialog").scrollWidth<=document.getElementById("holdingBookDialog").clientWidth'),'mobile dialog overflow');
const mobileShot=await send('Page.captureScreenshot',{format:'png'});(await import('node:fs')).writeFileSync('/tmp/costbuddy-holding-mobile.png',Buffer.from(mobileShot.result.data,'base64'));
console.log('PASS switching/reload, search/filter, full details, copy, rename, delete/undo, import/restore, storage failure/retry and mobile width');ws.close();

