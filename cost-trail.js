(function(root) {
  'use strict';
  function normalize(source) {
    if (!source || !["hk","cn","us"].includes(source.market) || !Array.isArray(source.nodes) || !source.nodes.length) return null;
    var nodes = source.nodes.filter(function(n, index) {
      if (!n || !Number.isFinite(n.cost) || !Number.isInteger(n.shares) || n.shares <= 0) return false;
      if (!index) return true;
      return Number.isInteger(n.buyShares) && n.buyShares > 0 && Number.isFinite(n.buyPrice) && n.buyPrice >= 0
        && Number.isFinite(n.buyFee) && n.buyFee >= 0 && n.beforeValues && Number.isFinite(n.beforeValues.currentCost) && Number.isInteger(n.beforeValues.currentShares) && n.beforeValues.currentShares > 0;
    });
    if (nodes.length !== source.nodes.length) return null;
    return JSON.parse(JSON.stringify({market:source.market, stockCode:source.stockCode || '', stockName:source.stockName || '', nodes:nodes, archivedSegments:Array.isArray(source.archivedSegments)?source.archivedSegments:[]}));
  }
  function matches(history, values) {
    if (!history) return false;
    var last = history.nodes[history.nodes.length - 1];
    return history.market === values.market && history.stockCode === (values.stockCode || '')
      && (!history.stockCode ? history.stockName === (values.stockName || '') : true)
      && last.shares === values.currentShares && Math.abs(last.cost - values.currentCost) < 1e-8 * Math.max(1,Math.abs(last.cost));
  }
  function commit(history, values, now) {
    if (!(values.buyShares > 0) || !Number.isInteger(values.buyShares) || values.sellShares > 0
      || !(values.currentShares > 0) || !Number.isFinite(values.currentCost) || values.currentCost < 0
      || !Number.isFinite(values.buyPrice) || values.buyPrice < 0 || !Number.isFinite(values.buyFee) || values.buyFee < 0) throw new Error('invalid-purchase');
    var next = matches(history, values) ? normalize(history) : {market:values.market,stockCode:values.stockCode || '',stockName:values.stockName || '',nodes:[{cost:values.currentCost,shares:values.currentShares,at:now || Date.now()}]};
    var shares = values.currentShares + values.buyShares;
    var cost = (values.currentShares * values.currentCost + values.buyShares * values.buyPrice + values.buyFee) / shares;
    if (!Number.isFinite(cost)) throw new Error('invalid-result');
    next.nodes.push({cost:cost,shares:shares,at:now || Date.now(),buyShares:values.buyShares,buyPrice:values.buyPrice,buyFee:values.buyFee,beforeValues:JSON.parse(JSON.stringify(values))});
    return next;
  }
  var api = {normalize:normalize,matches:matches,commit:commit};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CostTrail = api;
}(typeof window !== 'undefined' ? window : globalThis));
