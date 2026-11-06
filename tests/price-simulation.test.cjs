const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const exists = fs.existsSync(require('node:path').join(__dirname, '../price-simulation.js'));
const simulation = exists ? require('../price-simulation.js') : {};
test('hypothetical market value and P&L use final holdings and recoverable cost', () => {
  assert.equal(typeof simulation.project, 'function');
  const input = {marketPrice: 20};
  const result = {finalShares: 120, recoverableCost: 3000, newDilutedCost: 25};
  const before = JSON.stringify({input, result});
  assert.deepEqual(simulation.project(input, result, 30), {price:30, marketValue:3600, pnl:600, pnlPercent:20, changePercent:50});
  assert.equal(JSON.stringify({input, result}), before);
});
test('zero price means full loss; zero or negative basis has no misleading return percentage', () => {
  assert.equal(typeof simulation.project, 'function');
  assert.equal(simulation.project({marketPrice:20}, {finalShares:100,recoverableCost:2000}, 0).pnl, -2000);
  assert.equal(simulation.project({marketPrice:0}, {finalShares:100,recoverableCost:0}, 10).pnlPercent, null);
  assert.equal(simulation.project({marketPrice:0}, {finalShares:100,recoverableCost:-10}, 10).changePercent, null);
  assert.equal(simulation.project({marketPrice:20}, {finalShares:100,recoverableCost:-10}, 10).pnlPercent, null);
});
test('invalid values do not produce a simulated financial result', () => {
  assert.equal(typeof simulation.project, 'function');
  for (const price of [-1, NaN, Infinity]) assert.equal(simulation.project({marketPrice:20}, {finalShares:100,recoverableCost:2000}, price), null);
  assert.equal(simulation.project({}, {error:'invalid'}, 20), null);
});
