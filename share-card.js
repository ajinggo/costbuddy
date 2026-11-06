(function () {
  'use strict';
  var dialog = document.createElement('dialog');
  dialog.id = 'shareCardDialog';
  dialog.className = 'app-dialog share-card-dialog';
  dialog.setAttribute('aria-labelledby', 'shareCardTitle');
  dialog.innerHTML = '<div class="dialog-header"><h2 id="shareCardTitle">分享测算卡片</h2><button type="button" class="dialog-close" aria-label="关闭分享">×</button></div><div class="share-card-body"><canvas width="1080" height="1350" role="img" aria-label="测算卡片预览"></canvas><div class="share-card-options"><label><input id="shareShowQuantity" type="checkbox">展示交易股数</label><label><input id="shareShowAmounts" type="checkbox">展示手续费与资金金额</label><p>默认隐藏股数与资金金额。预览与导出一致，图片仅在本机生成。</p><p id="shareCardStatus" role="status" aria-live="polite"></p></div></div><div class="dialog-actions"><button id="shareCopySite" class="dialog-secondary" type="button">复制工具链接</button><button id="shareSaveImage" class="dialog-primary" type="button">保存图片</button></div>';
  document.body.appendChild(dialog);
  var canvas=dialog.querySelector('canvas'), ctx=canvas.getContext('2d'), snapshot;
  var quantity=dialog.querySelector('#shareShowQuantity'), amounts=dialog.querySelector('#shareShowAmounts');
  function money(n){return (snapshot.input.market==='us'?'$':snapshot.input.market==='cn'?'¥':'HK$')+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function text(value,x,y,size,color,weight,max){
    do{ctx.font=(weight||400)+' '+size+'px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';if(!max||ctx.measureText(value).width<=max)break;size--;}while(size>14);
    ctx.fillStyle=color||'#1d1d1f';ctx.fillText(value,x,y);
  }
  function line(y){ctx.strokeStyle='#dedee3';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(80,y);ctx.lineTo(1000,y);ctx.stroke();}
  function render(){
    var i=snapshot.input,r=snapshot.result,buy=i.buyShares>0,sell=i.sellShares>0;
    var title=sell?'交易成本测算':buy?'加仓成本测算':'当前持仓快照';
    ctx.clearRect(0,0,1080,1350);ctx.fillStyle='#fafaf8';ctx.fillRect(0,0,1080,1350);
    var glow=ctx.createRadialGradient(1000,0,0,1000,0,700);glow.addColorStop(0,'#e8f0fc');glow.addColorStop(1,'#fafaf800');ctx.fillStyle=glow;ctx.fillRect(0,0,1080,800);
    text('CostBuddy',80,106,34,'#1d1d1f',650);text('你的做T搭子',285,106,23,'#77777d');
    text(i.market==='us'?'美股 · USD':i.market==='cn'?'A 股 · CNY':'港股 · HKD',800,106,24,'#6e6e73');line(145);
    text((i.stockName||'未命名证券')+(i.stockCode?' · '+i.stockCode:''),80,246,44,'#1d1d1f',600,920);
    text(title,80,300,26,'#6e6e73');
    text(sell?'交易前成本':buy?'加仓前成本':'当前每股成本',80,405,24,'#6e6e73');
    text(money(i.currentCost),80,488,66,'#78787e',500,920);
    text(sell?'交易后回本成本':buy?'加仓后成本':'每股成本',80,594,24,'#6e6e73');
    text(money(r.newDilutedCost),80,712,106,'#0071e3',650,920);
    var delta=r.newDilutedCost-i.currentCost;
    var change=Math.abs(delta)<0.005?'每股成本持平':'每股成本'+(delta<0?'降低 ':'增加 ')+money(Math.abs(delta));
    if(i.currentCost>0&&Math.abs(delta)>=0.005)change+=' · '+(Math.abs(delta)/i.currentCost*100).toFixed(2)+'%';
    text(change,80,780,29,'#4d535b',400,920);line(826);
    var rows=[];
    if(buy)rows.push(['买入价格',money(i.buyPrice)]);if(sell)rows.push(['卖出价格',money(i.sellPrice)]);
    if(quantity.checked){if(buy)rows.push(['买入数量',i.buyShares.toLocaleString()+' 股']);if(sell)rows.push(['卖出数量',i.sellShares.toLocaleString()+' 股']);}
    if(amounts.checked){rows.push(['手续费合计',money(r.totalFees)]);rows.push(['本次净'+(r.netCashFlow>0?'收回':'投入'),money(Math.abs(r.netCashFlow))]);}
    if(!rows.length)rows.push(['测算状态','未设置买卖计划']);
    rows.forEach(function(row,index){var y=879+index*Math.min(59,290/rows.length);text(row[0],80,y,25,'#6e6e73');ctx.textAlign='right';text(row[1],1000,y,28,'#1d1d1f',500,600);ctx.textAlign='left';});
    line(1190);text(buy||sell?'按所填参数测算 · 不代表实际成交':'按当前输入生成 · 非实时行情',80,1240,23,'#6e6e73');text('仅供个人测算参考，不构成投资建议',80,1286,22,'#8b8b90');
    canvas.setAttribute('aria-label',title+'，原成本 '+money(i.currentCost)+'，新成本 '+money(r.newDilutedCost)+'，'+change);
    canvas.dataset.rowLabels=rows.map(function(row){return row[0];}).join(',');
    var savedPreview=dialog.querySelector('.share-save-preview');if(savedPreview)savedPreview.src=canvas.toDataURL('image/png');
  }
  quantity.onchange=render;amounts.onchange=render;
  dialog.querySelector('.dialog-close').onclick=function(){dialog.close();};
  dialog.addEventListener('click',function(e){if(e.target===dialog)dialog.close();});
  dialog.querySelector('#shareSaveImage').onclick=function(){
    canvas.toBlob(function(blob){
      var status=dialog.querySelector('#shareCardStatus');if(!blob){status.textContent='图片生成失败，请重试。';return;}
      var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='CostBuddy-测算卡.png';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
      status.textContent='图片已生成，请查看浏览器下载；手机也可长按下方图片保存。';
      var img=dialog.querySelector('.share-save-preview');if(!img){img=document.createElement('img');img.className='share-save-preview';img.alt='可长按保存的分享卡片';dialog.querySelector('.share-card-options').appendChild(img);}img.src=canvas.toDataURL('image/png');
    },'image/png');
  };
  dialog.querySelector('#shareCopySite').onclick=async function(){
    var url=new URL(location.href);url.search='';url.hash='';
    try{await navigator.clipboard.writeText(url.href);dialog.querySelector('#shareCardStatus').textContent='已复制工具链接，不含持仓或测算参数。';}catch(e){dialog.querySelector('#shareCardStatus').textContent='复制失败，请从地址栏复制网站地址。';}
  };
  window.CostBuddyShare={open:function(input,result){snapshot={input:input,result:result};quantity.checked=false;amounts.checked=false;dialog.querySelector('#shareCardStatus').textContent='';var img=dialog.querySelector('.share-save-preview');if(img)img.remove();render();if(!dialog.open)dialog.showModal();}};
}());
