const {test}=require('node:test');
const assert=require('node:assert/strict');
const trail=require('../cost-trail.js');
test('two purchases accumulate without rounding or repeating the prior plan',()=>{
 const start={market:'hk',stockCode:'00700',stockName:'',currentShares:600,currentCost:94,buyShares:100,buyPrice:49,buyFee:18.5,sellShares:0};
 const one=trail.commit(null,start,1000);
 assert.equal(one.nodes.length,2);
 assert.equal(one.nodes[1].shares,700);
 assert.equal(one.nodes[1].cost,(600*94+4918.5)/700);
 const two=trail.commit(one,{...start,currentShares:700,currentCost:one.nodes[1].cost,buyShares:200,buyPrice:30,buyFee:20},2000);
 assert.equal(two.nodes.length,3);
 assert.equal(two.nodes[2].cost,(600*94+4918.5+6020)/900);
 assert.equal(one.nodes.length,2);
});
test('requires an explicit nonzero purchase and rejects mixed sell plans',()=>{
 const v={market:'hk',stockCode:'1',currentShares:100,currentCost:10,buyShares:0,buyPrice:5,buyFee:0,sellShares:0};
 assert.throws(()=>trail.commit(null,v));
 assert.throws(()=>trail.commit(null,{...v,buyShares:100,sellShares:10}));
});
test('changed baseline or security starts a separate trajectory',()=>{
 const v={market:'hk',stockCode:'1',currentShares:100,currentCost:10,buyShares:100,buyPrice:5,buyFee:0,sellShares:0};
 const a=trail.commit(null,v);
 const b=trail.commit(a,{...v,stockCode:'2'});
 assert.equal(b.nodes.length,2); assert.equal(b.stockCode,'2');
 assert.equal(trail.normalize(JSON.parse(JSON.stringify(a))).nodes.length,2);
});
