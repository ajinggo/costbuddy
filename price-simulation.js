(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CostBuddySimulation = api;
})(typeof window !== 'undefined' ? window : this, function() {
  'use strict';
  return {project:function(input, result, price) {
    if (!result || result.error || !Number.isFinite(price) || price < 0 || !Number.isFinite(result.finalShares) || result.finalShares <= 0 || !Number.isFinite(result.recoverableCost)) return null;
    var value = price * result.finalShares, pnl = value - result.recoverableCost;
    return {price:price, marketValue:value, pnl:pnl, pnlPercent:result.recoverableCost > 0 ? pnl / result.recoverableCost * 100 : null, changePercent:input.marketPrice > 0 ? (price / input.marketPrice - 1) * 100 : null};
  }};
});
