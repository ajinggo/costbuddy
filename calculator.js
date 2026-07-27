(function () {
  "use strict";

  var STORAGE_KEY = "hk-diluted-cost-calculator-v1";
  var SCENARIO_STORAGE_KEY = "hk-diluted-cost-calculator-scenarios-v1";
  var HOLDINGS_STORAGE_KEY = "hk-diluted-cost-calculator-holdings-v1";
  var CURRENT_HOLDING_STORAGE_KEY = "hk-diluted-cost-calculator-current-holding-v1";
  var BACKUP_FORMAT = "costbuddy-backup";
  var BACKUP_VERSION = 1;
  var MAX_BACKUP_FILE_SIZE = 2 * 1024 * 1024;
  var SHARE_FIELDS = {
    currentShares: "cs",
    currentCost: "cc",
    marketPrice: "mp",
    lotSize: "ls",
    sellShares: "ss",
    sellPrice: "sp",
    sellFee: "sf",
    buyShares: "bs",
    buyPrice: "bp",
    buyFee: "bf",
    targetCost: "tc"
  };
  var SHARE_TEXT_FIELDS = {
    stockCode: "code",
    stockName: "name"
  };
  var TEXT_DEFAULTS = {
    stockCode: "",
    stockName: ""
  };
  var DEFAULTS = {
    currentShares: 600,
    currentCost: 94,
    marketPrice: 49,
    lotSize: 100,
    sellShares: 100,
    sellPrice: 60,
    sellFee: 18.5,
    buyShares: 100,
    buyPrice: 49,
    buyFee: 18.5,
    targetCost: 90
  };
  var DEFAULT_FEE_SETTINGS = {
    mode: "manual",
    securityType: "stock",
    commissionRate: 0.03,
    minimumCommission: 3,
    includeStampDuty: true,
    includeSettlementFee: true,
    manualSellFee: 18.5,
    manualBuyFee: 18.5
  };
  var NEW_MEASUREMENT_VALUES = {
    currentShares: 0,
    currentCost: 0,
    marketPrice: 0,
    lotSize: 100,
    sellShares: 0,
    sellPrice: 0,
    sellFee: 0,
    buyShares: 0,
    buyPrice: 0,
    buyFee: 0,
    targetCost: 0,
    stockCode: "",
    stockName: ""
  };

  var form = document.getElementById("calculatorForm");
  var resetButton = document.getElementById("resetButton");
  var sellRange = document.getElementById("sellPriceRange");
  var buyRange = document.getElementById("buyPriceRange");
  var sellPriceInput = document.getElementById("sellPrice");
  var buyPriceInput = document.getElementById("buyPrice");
  var targetCostInput = document.getElementById("targetCost");
  var validationMessage = document.getElementById("validationMessage");
  var comparisonBody = document.getElementById("comparisonBody");
  var applyTargetPlanButton = document.getElementById("applyTargetPlan");
  var copyResultButton = document.getElementById("copyResultButton");
  var copyToast = document.getElementById("copyToast");
  var feeSettingsButton = document.getElementById("feeSettingsButton");
  var feeDialog = document.getElementById("feeDialog");
  var basisInfoButton = document.getElementById("basisInfoButton");
  var basisDialog = document.getElementById("basisDialog");
  var scenarioButton = document.getElementById("scenarioButton");
  var sharePlanButton = document.getElementById("sharePlanButton");
  var scenarioDialog = document.getElementById("scenarioDialog");
  var holdingBookButton = document.getElementById("holdingBookButton");
  var holdingBookDialog = document.getElementById("holdingBookDialog");
  var holdingBookNewButton = document.getElementById("holdingBookNewButton");
  var holdingList = document.getElementById("holdingList");
  var holdingEmpty = document.getElementById("holdingEmpty");
  var newMeasurementButton = document.getElementById("newMeasurementButton");
  var saveHoldingButton = document.getElementById("saveHoldingButton");
  var unsavedDialog = document.getElementById("unsavedDialog");
  var exportBackupButton = document.getElementById("exportBackupButton");
  var importBackupButton = document.getElementById("importBackupButton");
  var backupFileInput = document.getElementById("backupFileInput");
  var importBackupDialog = document.getElementById("importBackupDialog");
  var feeSettings = Object.assign({}, DEFAULT_FEE_SETTINGS);
  var latestTargetPlan = null;
  var latestInput = null;
  var latestResult = null;
  var toastTimer = null;
  var resetConfirmTimer = null;
  var resetArmed = false;
  var scenarios = { A: null, B: null };
  var holdingRecords = [];
  var currentRecordId = null;
  var savedRecordSignature = null;
  var pendingUnsavedAction = null;
  var pendingDeleteId = null;
  var pendingImportBackup = null;

  function element(id) {
    return document.getElementById(id);
  }

  function numberValue(id) {
    var parsed = Number(element(id).value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function textValue(id) {
    return String(element(id).value || "").trim();
  }

  function normalizedStockCode(value) {
    var code = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
    return /^\d{1,5}$/.test(code) ? code.padStart(5, "0") : code.slice(0, 5);
  }

  function stockLabel(input) {
    return [input.stockCode, input.stockName].filter(Boolean).join(" ");
  }

  function securityTypeLabel(type, shortLabel) {
    if (type === "stamp-exempt") {
      return shortLabel ? "豁免" : "印花税豁免证券";
    }
    if (type === "custom") {
      return "自定义";
    }
    return shortLabel ? "港股" : "普通港股";
  }

  function formatNumber(value, digits) {
    return Math.abs(value).toLocaleString("zh-HK", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function formatMoney(value) {
    return (value < 0 ? "−" : "") + "HK$" + formatNumber(value, 2);
  }

  function formatSignedMoney(value) {
    return (value >= 0 ? "+" : "−") + "HK$" + formatNumber(value, 2);
  }

  function compactNumber(value) {
    return Number(value.toFixed(2)).toString();
  }

  function roundCurrency(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function calculateEstimatedFee(shares, price, settings) {
    var turnover = Math.max(0, shares) * Math.max(0, price);
    if (turnover <= 0) {
      return {
        turnover: 0,
        commission: 0,
        stampDuty: 0,
        transactionLevy: 0,
        afrcLevy: 0,
        tradingFee: 0,
        settlementFee: 0,
        total: 0
      };
    }

    var commission = Math.max(
      turnover * Math.max(0, settings.commissionRate) / 100,
      Math.max(0, settings.minimumCommission)
    );
    var stampDuty = settings.includeStampDuty ? Math.ceil(turnover * 0.001) : 0;
    var transactionLevy = roundCurrency(turnover * 0.000027);
    var afrcLevy = roundCurrency(turnover * 0.0000015);
    var tradingFee = roundCurrency(turnover * 0.0000565);
    var settlementFee = settings.includeSettlementFee
      ? roundCurrency(turnover * 0.000042)
      : 0;
    var total = roundCurrency(
      commission + stampDuty + transactionLevy + afrcLevy + tradingFee + settlementFee
    );

    return {
      turnover: turnover,
      commission: roundCurrency(commission),
      stampDuty: stampDuty,
      transactionLevy: transactionLevy,
      afrcLevy: afrcLevy,
      tradingFee: tradingFee,
      settlementFee: settlementFee,
      total: total
    };
  }

  function getBuyFeeFor(input, shares, price) {
    return input.feeMode === "auto"
      ? calculateEstimatedFee(shares, price, input.feeSettings).total
      : input.buyFee;
  }

  function setFeeInputPresentation(isAuto) {
    ["sellFee", "buyFee"].forEach(function (id) {
      var feeInput = element(id);
      feeInput.readOnly = isAuto;
      feeInput.closest(".input-wrap").classList.toggle("is-auto-fee", isAuto);
    });
    setText("feeModeLabel", isAuto ? "自动·" + securityTypeLabel(feeSettings.securityType, true) : "手动");
    setText("buyFeeLabel", isAuto ? "买入费用 · 自动" : "买入费用");
    setText("sellFeeLabel", isAuto ? "卖出费用 · 自动" : "卖出费用");
    feeSettingsButton.classList.toggle("is-auto", isAuto);
  }

  function getInputs() {
    var input = {
      currentShares: numberValue("currentShares"),
      currentCost: numberValue("currentCost"),
      marketPrice: numberValue("marketPrice"),
      lotSize: numberValue("lotSize"),
      sellShares: numberValue("sellShares"),
      sellPrice: numberValue("sellPrice"),
      sellFee: numberValue("sellFee"),
      buyShares: numberValue("buyShares"),
      buyPrice: numberValue("buyPrice"),
      buyFee: numberValue("buyFee"),
      targetCost: numberValue("targetCost"),
      stockCode: normalizedStockCode(textValue("stockCode")),
      stockName: textValue("stockName"),
      feeMode: feeSettings.mode,
      feeSettings: Object.assign({}, feeSettings)
    };

    if (feeSettings.mode === "auto") {
      input.sellFee = calculateEstimatedFee(input.sellShares, input.sellPrice, feeSettings).total;
      input.buyFee = calculateEstimatedFee(input.buyShares, input.buyPrice, feeSettings).total;
      element("sellFee").value = input.sellFee.toFixed(2);
      element("buyFee").value = input.buyFee.toFixed(2);
    } else {
      feeSettings.manualSellFee = input.sellFee;
      feeSettings.manualBuyFee = input.buyFee;
    }

    setFeeInputPresentation(feeSettings.mode === "auto");
    return input;
  }

  function calculateCosts(input) {
    var nonNegativeFields = [
      input.currentCost,
      input.marketPrice,
      input.sellShares,
      input.sellPrice,
      input.sellFee,
      input.buyShares,
      input.buyPrice,
      input.buyFee
    ];

    if (input.currentShares <= 0) {
      return { error: "目前股数必须大于 0。" };
    }
    if (input.lotSize <= 0) {
      return { error: "每手股数必须大于 0。" };
    }
    if (!Number.isInteger(input.currentShares) || !Number.isInteger(input.sellShares)
      || !Number.isInteger(input.buyShares) || !Number.isInteger(input.lotSize)) {
      return { error: "股数和每手股数请填写整数。" };
    }
    if (nonNegativeFields.some(function (value) { return value < 0; })) {
      return { error: "成本、股价、股数和手续费不能为负数。" };
    }
    if (input.sellShares > input.currentShares) {
      return { error: "卖出股数不能超过目前持仓。" };
    }

    var remainingShares = input.currentShares - input.sellShares;
    var finalShares = remainingShares + input.buyShares;
    if (finalShares <= 0) {
      return { error: "交易后持仓必须大于 0 股，才能计算回本成本。" };
    }

    var appliedSellFee = input.sellShares > 0 ? input.sellFee : 0;
    var appliedBuyFee = input.buyShares > 0 ? input.buyFee : 0;
    var originalBasis = input.currentShares * input.currentCost;
    var grossSale = input.sellShares * input.sellPrice;
    var netSaleProceeds = grossSale - appliedSellFee;
    var basisAfterSale = originalBasis - netSaleProceeds;
    var buyOutlay = input.buyShares * input.buyPrice + appliedBuyFee;
    var recoverableCost = basisAfterSale + buyOutlay;
    var newDilutedCost = recoverableCost / finalShares;
    var afterSellCost = remainingShares > 0 ? basisAfterSale / remainingShares : null;
    var totalPnl = finalShares * input.marketPrice - recoverableCost;
    var breakEvenGap = input.marketPrice > 0
      ? (newDilutedCost / input.marketPrice - 1) * 100
      : null;

    return {
      remainingShares: remainingShares,
      finalShares: finalShares,
      originalBasis: originalBasis,
      grossSale: grossSale,
      netSaleProceeds: netSaleProceeds,
      basisAfterSale: basisAfterSale,
      afterSellCost: afterSellCost,
      buyOutlay: buyOutlay,
      recoverableCost: recoverableCost,
      newDilutedCost: newDilutedCost,
      totalPnl: totalPnl,
      breakEvenGap: breakEvenGap,
      netCashFlow: netSaleProceeds - buyOutlay,
      appliedSellFee: appliedSellFee,
      appliedBuyFee: appliedBuyFee,
      totalFees: appliedSellFee + appliedBuyFee,
      costDelta: newDilutedCost - input.currentCost
    };
  }

  function calculateTargetPlan(input, result) {
    var target = input.targetCost;

    if (target <= 0) {
      return { status: "invalid", message: "目标成本必须大于 0。" };
    }

    if (result.remainingShares > 0 && result.afterSellCost <= target) {
      return {
        status: "none",
        message: "卖出后的成本已是 " + formatMoney(result.afterSellCost) + "，无需加仓即可达到目标。"
      };
    }

    if (target <= input.buyPrice) {
      return {
        status: "impossible",
        message: "当前买入价不低于目标成本，继续买入只能趋近买入价，无法摊薄至该目标。"
      };
    }

    var theoreticalShares;
    if (input.feeMode === "auto") {
      var low = 0;
      var high = Math.max(1, input.lotSize);
      var estimatedCost = function (shares) {
        var fee = getBuyFeeFor(input, shares, input.buyPrice);
        return (result.basisAfterSale + shares * input.buyPrice + fee)
          / (result.remainingShares + shares);
      };

      while (high < 1e9 && estimatedCost(high) > target) {
        high *= 2;
      }
      if (estimatedCost(high) > target) {
        return {
          status: "impossible",
          message: "在当前价格和自动费用设置下，无法计算出可达到目标的买入股数。"
        };
      }
      for (var searchIndex = 0; searchIndex < 70; searchIndex += 1) {
        var middle = (low + high) / 2;
        if (estimatedCost(middle) <= target) {
          high = middle;
        } else {
          low = middle;
        }
      }
      theoreticalShares = high;
    } else {
      theoreticalShares = (result.basisAfterSale + input.buyFee - target * result.remainingShares)
        / (target - input.buyPrice);
      theoreticalShares = Math.max(0, theoreticalShares);
    }

    var wholeShares = Math.max(1, Math.ceil(theoreticalShares - 1e-9));
    var lotShares = Math.ceil(wholeShares / input.lotSize) * input.lotSize;
    var lots = lotShares / input.lotSize;
    var planBuyFee = getBuyFeeFor(input, lotShares, input.buyPrice);
    var outlay = lotShares * input.buyPrice + planBuyFee;
    var finalShares = result.remainingShares + lotShares;
    var actualCost = (result.basisAfterSale + outlay) / finalShares;

    return {
      status: "needed",
      theoreticalShares: theoreticalShares,
      lotShares: lotShares,
      lots: lots,
      outlay: outlay,
      actualCost: actualCost,
      message: "理论需买入 " + formatNumber(theoreticalShares, 2)
        + " 股；按 " + formatNumber(input.lotSize, 0) + " 股一手，至少买入 "
        + formatNumber(lots, 0) + " 手。"
    };
  }

  function calculateLotPlans(input, result) {
    var plans = [];
    var lots;

    for (lots = 1; lots <= 5; lots += 1) {
      var shares = lots * input.lotSize;
      var planBuyFee = getBuyFeeFor(input, shares, input.buyPrice);
      var outlay = shares * input.buyPrice + planBuyFee;
      var finalShares = result.remainingShares + shares;
      plans.push({
        lots: lots,
        shares: shares,
        outlay: outlay,
        actualCost: (result.basisAfterSale + outlay) / finalShares
      });
    }
    return plans;
  }

  function setText(id, text) {
    element(id).textContent = text;
  }

  function updatePricePosition(input, result) {
    var ratio;
    if (result.newDilutedCost <= 0) {
      ratio = 100;
    } else {
      ratio = input.marketPrice / result.newDilutedCost * 100;
    }
    ratio = Math.max(0, Math.min(100, ratio));

    element("positionFill").style.width = ratio.toFixed(2) + "%";
    element("positionDot").style.left = ratio.toFixed(2) + "%";
    setText("positionSummary", formatMoney(input.marketPrice) + " / " + formatMoney(result.newDilutedCost));
    setText("breakEvenLabel", "回本 " + formatMoney(result.newDilutedCost));
  }

  function updateStages(input, result) {
    setText("beforeStageCost", formatMoney(input.currentCost));
    setText("beforeStageShares", formatNumber(input.currentShares, 0) + " 股");
    setText("afterSellStageCost", result.afterSellCost === null ? "已清仓" : formatMoney(result.afterSellCost));
    setText("afterSellStageShares", result.afterSellCost === null
      ? "0 股 · 暂无每股成本"
      : formatNumber(result.remainingShares, 0) + " 股");
    setText("afterBuyStageCost", formatMoney(result.newDilutedCost));
    setText("afterBuyStageShares", formatNumber(result.finalShares, 0) + " 股");
  }

  function renderTargetPlan(input, result) {
    var plan = calculateTargetPlan(input, result);
    latestTargetPlan = plan.status === "needed" ? plan : null;

    setText("targetPlanBadge", "目标 " + formatMoney(input.targetCost));
    setText("targetPlanMessage", plan.message);
    element("targetPlanBody").className = "target-plan-body target-plan-" + plan.status;

    if (plan.status === "needed") {
      setText("targetPlanShares", formatNumber(plan.lotShares, 0) + " 股");
      setText("targetPlanOutlay", formatMoney(plan.outlay));
      setText("targetPlanActualCost", formatMoney(plan.actualCost));
      applyTargetPlanButton.textContent = "应用 " + formatNumber(plan.lots, 0) + " 手方案";
      applyTargetPlanButton.hidden = false;
      applyTargetPlanButton.disabled = false;
      return;
    }

    setText("targetPlanShares", "—");
    setText("targetPlanOutlay", "—");
    setText("targetPlanActualCost", "—");
    applyTargetPlanButton.hidden = true;
    applyTargetPlanButton.disabled = true;
  }

  function createCell(text) {
    var cell = document.createElement("td");
    cell.textContent = text;
    return cell;
  }

  function renderPlanComparison(input, result) {
    var plans = calculateLotPlans(input, result);
    comparisonBody.replaceChildren();

    plans.forEach(function (plan) {
      var row = document.createElement("tr");
      var isSelected = Math.abs(input.buyShares - plan.shares) < 1e-9;
      var planCell = createCell(plan.lots + " 手");
      var actionCell = document.createElement("td");
      var actionButton = document.createElement("button");

      if (isSelected) {
        row.classList.add("is-selected");
        var badge = document.createElement("small");
        badge.className = "current-badge";
        badge.textContent = "当前";
        planCell.appendChild(badge);
      }

      actionButton.type = "button";
      actionButton.className = "table-action";
      actionButton.dataset.shares = String(plan.shares);
      actionButton.textContent = isSelected ? "已选" : "选用";
      actionButton.disabled = isSelected;
      actionButton.setAttribute("aria-label", "选用 " + plan.lots + " 手买入方案");
      actionCell.appendChild(actionButton);

      row.appendChild(planCell);
      row.appendChild(createCell(formatNumber(plan.shares, 0) + " 股"));
      row.appendChild(createCell(formatMoney(plan.outlay)));
      row.appendChild(createCell(formatMoney(plan.actualCost)));
      row.appendChild(actionCell);
      comparisonBody.appendChild(row);
    });
  }

  function renderUnavailable(isEmptyState) {
    latestTargetPlan = null;
    element("resultInsight").hidden = true;
    element("resultInsight").textContent = "";
    setText("calculationBadge", isEmptyState ? "等待输入" : "输入待修正");
    setText("newDilutedCost", "—");
    setText("costChange", isEmptyState ? "填写交易参数后生成结果" : "修正参数后重新计算");
    element("costChange").className = "cost-change cost-neutral";
    setText("netCashFlow", "—");
    element("netCashFlow").className = "";
    ["finalShares", "recoverableCost", "totalPnl", "breakEvenGap"].forEach(function (id) {
      setText(id, "—");
      element(id).className = "";
    });
    ["originalBasis", "netSaleProceeds", "buyOutlay", "totalFees"].forEach(function (id) {
      setText(id, "—");
    });
    ["beforeStageCost", "beforeStageShares", "afterSellStageCost", "afterSellStageShares", "afterBuyStageCost", "afterBuyStageShares"].forEach(function (id) {
      setText(id, "—");
    });
    setText("positionSummary", "— / —");
    setText("breakEvenLabel", "回本 —");
    element("positionFill").style.width = "0%";
    element("positionDot").style.left = "0%";
    setText("formulaText", isEmptyState ? "填写参数后生成计算过程。" : "请先修正输入内容。");
    element("chartGrid").replaceChildren();
    element("chartLine").setAttribute("d", "");
    element("chartArea").setAttribute("d", "");
    element("chartVerticalGuide").setAttribute("visibility", "hidden");
    element("chartHorizontalGuide").setAttribute("visibility", "hidden");
    element("chartPoint").setAttribute("visibility", "hidden");
    element("chartPointCallout").setAttribute("visibility", "hidden");
    setText("targetPlanBadge", "目标 —");
    setText("targetPlanMessage", isEmptyState ? "填写左侧参数后开始测算。" : "请先修正输入内容。");
    setText("targetPlanShares", "—");
    setText("targetPlanOutlay", "—");
    setText("targetPlanActualCost", "—");
    applyTargetPlanButton.hidden = true;
    applyTargetPlanButton.disabled = true;
    comparisonBody.replaceChildren();
  }

  function svgNode(name, attributes, text) {
    var node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attributes).forEach(function (key) {
      node.setAttribute(key, attributes[key]);
    });
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  }

  function drawChart(input, result) {
    var width = 620;
    var height = 240;
    var padding = { left: 54, right: 18, top: 28, bottom: 34 };
    element("chartVerticalGuide").removeAttribute("visibility");
    element("chartHorizontalGuide").removeAttribute("visibility");
    element("chartPoint").removeAttribute("visibility");
    element("chartPointCallout").removeAttribute("visibility");
    var plotWidth = width - padding.left - padding.right;
    var plotHeight = height - padding.top - padding.bottom;
    var center = Math.max(1, input.buyPrice);
    var xMin = Math.max(0, Math.floor(center * 0.45 / 5) * 5);
    var xMax = Math.max(xMin + 20, Math.ceil(center * 1.55 / 5) * 5);
    var baseWithoutPurchasePrice = result.basisAfterSale;
    var points = [];
    var index;

    for (index = 0; index <= 48; index += 1) {
      var price = xMin + (xMax - xMin) * index / 48;
      var chartBuyFee = input.buyShares > 0 ? getBuyFeeFor(input, input.buyShares, price) : 0;
      var cost = (baseWithoutPurchasePrice + input.buyShares * price + chartBuyFee) / result.finalShares;
      points.push({ price: price, cost: cost });
    }

    var costs = points.map(function (point) { return point.cost; });
    costs.push(result.newDilutedCost);
    var yMin = Math.min.apply(null, costs);
    var yMax = Math.max.apply(null, costs);
    var yPadding = Math.max(1, (yMax - yMin) * 0.25);
    yMin -= yPadding;
    yMax += yPadding;
    if (Math.abs(yMax - yMin) < 0.001) {
      yMax = yMin + 1;
    }

    function x(value) {
      return padding.left + (value - xMin) / (xMax - xMin) * plotWidth;
    }

    function y(value) {
      return padding.top + plotHeight - (value - yMin) / (yMax - yMin) * plotHeight;
    }

    var linePath = points.map(function (point, pointIndex) {
      return (pointIndex === 0 ? "M" : "L") + x(point.price).toFixed(1) + "," + y(point.cost).toFixed(1);
    }).join(" ");
    var areaPath = linePath
      + " L" + x(xMax).toFixed(1) + "," + (padding.top + plotHeight).toFixed(1)
      + " L" + x(xMin).toFixed(1) + "," + (padding.top + plotHeight).toFixed(1)
      + " Z";

    element("chartLine").setAttribute("d", linePath);
    element("chartArea").setAttribute("d", areaPath);

    var grid = element("chartGrid");
    grid.replaceChildren();
    for (index = 0; index <= 3; index += 1) {
      var yValue = yMin + (yMax - yMin) * index / 3;
      var yPosition = y(yValue);
      grid.appendChild(svgNode("line", {
        x1: padding.left,
        x2: padding.left + plotWidth,
        y1: yPosition,
        y2: yPosition,
        "class": "chart-grid-line"
      }));
      grid.appendChild(svgNode("text", {
        x: padding.left - 8,
        y: yPosition + 4,
        "text-anchor": "end",
        "class": "chart-axis-label"
      }, yValue.toFixed(1)));
    }

    [xMin, (xMin + xMax) / 2, xMax].forEach(function (tick) {
      grid.appendChild(svgNode("text", {
        x: x(tick),
        y: height - 9,
        "text-anchor": "middle",
        "class": "chart-axis-label"
      }, "HK$" + tick.toFixed(0)));
    });

    var pointX = x(Math.max(xMin, Math.min(xMax, input.buyPrice)));
    var pointY = y(result.newDilutedCost);
    var verticalGuide = element("chartVerticalGuide");
    var horizontalGuide = element("chartHorizontalGuide");
    verticalGuide.setAttribute("x1", pointX);
    verticalGuide.setAttribute("x2", pointX);
    verticalGuide.setAttribute("y1", pointY);
    verticalGuide.setAttribute("y2", padding.top + plotHeight);
    horizontalGuide.setAttribute("x1", padding.left);
    horizontalGuide.setAttribute("x2", pointX);
    horizontalGuide.setAttribute("y1", pointY);
    horizontalGuide.setAttribute("y2", pointY);
    element("chartPoint").setAttribute("cx", pointX);
    element("chartPoint").setAttribute("cy", pointY);

    var pointLabel = element("chartPointLabel");
    var pointLabelBg = element("chartPointLabelBg");
    var pointCallout = element("chartPointCallout");
    setText("chartPointLabel", "成本 " + result.newDilutedCost.toFixed(2));
    pointLabel.setAttribute("x", 8);
    pointLabel.setAttribute("y", 15);

    var calloutWidth = 78;
    var calloutHeight = 22;
    var calloutGap = 14;
    var calloutX = pointX + calloutGap;
    if (calloutX + calloutWidth > width - 8) {
      calloutX = pointX - calloutGap - calloutWidth;
    }
    var calloutY = pointY - calloutHeight - 10;
    if (calloutY < 7) {
      calloutY = pointY + 10;
    }

    pointLabelBg.setAttribute("width", calloutWidth);
    pointLabelBg.setAttribute("height", calloutHeight);
    pointCallout.setAttribute("transform", "translate(" + calloutX.toFixed(1) + "," + calloutY.toFixed(1) + ")");
  }

  function showError(message) {
    validationMessage.textContent = message;
    validationMessage.hidden = false;
  }

  function hideError() {
    validationMessage.hidden = true;
    validationMessage.textContent = "";
  }

  function updateDocumentTitle(input) {
    var label = stockLabel(input);
    document.title = label ? label + " · 小算盘 · costbuddy" : "小算盘 · costbuddy";
  }

  function updateResultInsight(input, result) {
    var message = "";
    if (result.newDilutedCost < 0) {
      message = "卖出净所得已超过仍需收回资金；负数不代表股价为负。";
    } else if (input.marketPrice <= 0) {
      message = "目前股价为 0，暂不能计算距回本百分比。";
    } else if (input.sellShares === input.currentShares
      && input.buyShares > 0 && input.buyShares < input.currentShares) {
      message = "回本资金集中到较少股数，单股回本成本可能明显放大。";
    } else if (input.buyShares > 0 && input.lotSize > 0 && input.buyShares % input.lotSize !== 0) {
      message = "当前买入股数不是整手，实际成交请确认碎股规则。";
    } else if (input.buyShares === 0 && input.sellShares === 0) {
      message = "当前没有设置交易，结果等于原持仓成本。";
    }
    element("resultInsight").textContent = message;
    element("resultInsight").hidden = !message;
  }

  function cancelResetConfirmation() {
    clearTimeout(resetConfirmTimer);
    resetConfirmTimer = null;
    resetArmed = false;
    resetButton.classList.remove("is-confirming");
    setText("resetButtonLabel", "恢复示例");
  }

  function armResetConfirmation() {
    clearTimeout(resetConfirmTimer);
    resetArmed = true;
    resetButton.classList.add("is-confirming");
    setText("resetButtonLabel", "再次确认");
    resetConfirmTimer = window.setTimeout(cancelResetConfirmation, 3000);
  }

  function restoreExample() {
    Object.keys(DEFAULTS).forEach(function (key) {
      element(key).value = DEFAULTS[key];
    });
    Object.keys(TEXT_DEFAULTS).forEach(function (key) {
      element(key).value = TEXT_DEFAULTS[key];
    });
    feeSettings = Object.assign({}, DEFAULT_FEE_SETTINGS);
    sellRange.value = DEFAULTS.sellPrice;
    buyRange.value = DEFAULTS.buyPrice;
    update();
    showCopyToast("已恢复示例参数", false);
  }

  function openDialog(dialog) {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  function selectedSecurityType() {
    var selected = document.querySelector('input[name="securityType"]:checked');
    var type = selected ? selected.value : "stock";
    return ["stock", "stamp-exempt", "custom"].indexOf(type) >= 0 ? type : "stock";
  }

  function syncSecurityTypePreset() {
    var type = selectedSecurityType();
    var stampDutyInput = element("includeStampDuty");
    if (type === "stock") {
      stampDutyInput.checked = true;
    } else if (type === "stamp-exempt") {
      stampDutyInput.checked = false;
    }
    stampDutyInput.disabled = type !== "custom";
    stampDutyInput.closest("label").classList.toggle("is-locked", type !== "custom");
    return type;
  }

  function dialogFeeSettings() {
    var selectedMode = document.querySelector('input[name="feeMode"]:checked');
    var securityType = syncSecurityTypePreset();
    return {
      mode: selectedMode ? selectedMode.value : "manual",
      securityType: securityType,
      commissionRate: Math.max(0, numberValue("commissionRate")),
      minimumCommission: Math.max(0, numberValue("minimumCommission")),
      includeStampDuty: element("includeStampDuty").checked,
      includeSettlementFee: element("includeSettlementFee").checked,
      manualSellFee: feeSettings.manualSellFee,
      manualBuyFee: feeSettings.manualBuyFee
    };
  }

  function refreshFeeDialog() {
    var settings = dialogFeeSettings();
    var isAuto = settings.mode === "auto";
    element("autoFeeSettings").hidden = !isAuto;
    setText("feeModeSummary", isAuto
      ? securityTypeLabel(settings.securityType, false) + " · 按成交金额估算"
      : "当前使用手动费用");

    var buyPreview = calculateEstimatedFee(
      numberValue("buyShares"),
      numberValue("buyPrice"),
      settings
    );
    var sellPreview = calculateEstimatedFee(
      numberValue("sellShares"),
      numberValue("sellPrice"),
      settings
    );
    setText("autoBuyFeePreview", formatMoney(buyPreview.total));
    setText("autoSellFeePreview", formatMoney(sellPreview.total));
  }

  function syncFeeDialog() {
    var selected = document.querySelector('input[name="feeMode"][value="' + feeSettings.mode + '"]');
    var selectedSecurity = document.querySelector('input[name="securityType"][value="' + feeSettings.securityType + '"]');
    if (selected) {
      selected.checked = true;
    }
    if (selectedSecurity) {
      selectedSecurity.checked = true;
    }
    element("commissionRate").value = feeSettings.commissionRate;
    element("minimumCommission").value = feeSettings.minimumCommission;
    element("includeStampDuty").checked = feeSettings.includeStampDuty;
    element("includeSettlementFee").checked = feeSettings.includeSettlementFee;
    syncSecurityTypePreset();
    refreshFeeDialog();
  }

  function applyFeeSettingsFromDialog() {
    var nextSettings = dialogFeeSettings();
    if (feeSettings.mode === "manual") {
      feeSettings.manualSellFee = numberValue("sellFee");
      feeSettings.manualBuyFee = numberValue("buyFee");
    }
    nextSettings.manualSellFee = feeSettings.manualSellFee;
    nextSettings.manualBuyFee = feeSettings.manualBuyFee;
    feeSettings = nextSettings;

    if (feeSettings.mode === "manual") {
      element("sellFee").value = feeSettings.manualSellFee;
      element("buyFee").value = feeSettings.manualBuyFee;
    }
    closeDialog(feeDialog);
    update();
  }

  function resultCopyText(input, result) {
    var cashFlowText = Math.abs(result.netCashFlow) < 0.005
      ? "现金流持平"
      : (result.netCashFlow > 0
        ? "净收回 " + formatMoney(result.netCashFlow)
        : "净投入 " + formatMoney(Math.abs(result.netCashFlow)));
    var lines = ["小算盘 · costbuddy"];
    if (stockLabel(input)) {
      lines.push("证券：" + stockLabel(input));
    }
    lines.push(
      "目前持仓：" + formatNumber(input.currentShares, 0) + " 股",
      "目前成本：" + formatMoney(input.currentCost) + " / 股",
      "买入：" + formatNumber(input.buyShares, 0) + " 股 × " + formatMoney(input.buyPrice),
      "卖出：" + formatNumber(input.sellShares, 0) + " 股 × " + formatMoney(input.sellPrice),
      "交易费用：" + formatMoney(result.totalFees) + "（" + (input.feeMode === "auto"
        ? "自动估算 · " + securityTypeLabel(input.feeSettings.securityType, false)
        : "手动填写") + "）",
      "交易后持仓：" + formatNumber(result.finalShares, 0) + " 股",
      "资金回本成本：" + formatMoney(result.newDilutedCost) + " / 股",
      "本次净现金流：" + cashFlowText,
      "仅用于持仓测算，不构成投资建议。"
    );
    return lines.join("\n");
  }

  function fallbackCopy(text) {
    var textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    var copied = document.execCommand("copy");
    textArea.remove();
    return copied ? Promise.resolve() : Promise.reject(new Error("copy failed"));
  }

  function showCopyToast(message, isError) {
    clearTimeout(toastTimer);
    copyToast.textContent = message;
    copyToast.classList.toggle("is-error", Boolean(isError));
    copyToast.hidden = false;
    toastTimer = window.setTimeout(function () {
      copyToast.hidden = true;
    }, 1800);
  }

  function copyText(text, successMessage) {
    var copyPromise = navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(text).catch(function () { return fallbackCopy(text); })
      : fallbackCopy(text);
    copyPromise.then(function () {
      showCopyToast(successMessage, false);
    }).catch(function () {
      showCopyToast("复制失败，请重试", true);
    });
  }

  function copyCurrentResult() {
    if (!latestInput || !latestResult) {
      showCopyToast("请先修正输入内容", true);
      return;
    }
    copyText(resultCopyText(latestInput, latestResult), "测算结果已复制");
  }

  function normalizedFeeSettings(source) {
    var settings = Object.assign({}, DEFAULT_FEE_SETTINGS);
    if (!source || typeof source !== "object") {
      return settings;
    }
    settings.mode = source.mode === "auto" ? "auto" : "manual";
    settings.securityType = ["stock", "stamp-exempt", "custom"].indexOf(source.securityType) >= 0
      ? source.securityType
      : (source.includeStampDuty === false ? "stamp-exempt" : "stock");
    ["commissionRate", "minimumCommission", "manualSellFee", "manualBuyFee"].forEach(function (key) {
      if (source[key] !== null && source[key] !== "" && Number.isFinite(Number(source[key]))) {
        settings[key] = Number(source[key]);
      }
    });
    settings.includeStampDuty = source.includeStampDuty !== false;
    if (settings.securityType === "stock") {
      settings.includeStampDuty = true;
    } else if (settings.securityType === "stamp-exempt") {
      settings.includeStampDuty = false;
    }
    settings.includeSettlementFee = source.includeSettlementFee !== false;
    return settings;
  }

  function captureFormValues() {
    var values = {};
    Object.keys(DEFAULTS).forEach(function (key) {
      values[key] = numberValue(key);
    });
    values.stockCode = normalizedStockCode(textValue("stockCode"));
    values.stockName = textValue("stockName");
    return values;
  }

  function inputFromState(values, settingsSource) {
    var settings = normalizedFeeSettings(settingsSource);
    var input = {};
    Object.keys(DEFAULTS).forEach(function (key) {
      input[key] = Number(values[key]);
    });
    input.stockCode = normalizedStockCode(values.stockCode);
    input.stockName = String(values.stockName || "").trim();
    input.feeMode = settings.mode;
    input.feeSettings = Object.assign({}, settings);
    if (settings.mode === "auto") {
      input.sellFee = calculateEstimatedFee(input.sellShares, input.sellPrice, settings).total;
      input.buyFee = calculateEstimatedFee(input.buyShares, input.buyPrice, settings).total;
    }
    return input;
  }

  function setCalculatorState(values, settingsSource, shouldUpdate) {
    Object.keys(DEFAULTS).forEach(function (key) {
      if (Number.isFinite(Number(values[key]))) {
        element(key).value = Number(values[key]);
      }
    });
    element("stockCode").value = normalizedStockCode(values.stockCode);
    element("stockName").value = String(values.stockName || "").trim();
    feeSettings = normalizedFeeSettings(settingsSource);
    if (feeSettings.mode === "manual") {
      feeSettings.manualSellFee = Number.isFinite(Number(values.sellFee))
        ? Number(values.sellFee)
        : feeSettings.manualSellFee;
      feeSettings.manualBuyFee = Number.isFinite(Number(values.buyFee))
        ? Number(values.buyFee)
        : feeSettings.manualBuyFee;
      element("sellFee").value = feeSettings.manualSellFee;
      element("buyFee").value = feeSettings.manualBuyFee;
    }
    syncRangeFromNumber(sellRange, sellPriceInput);
    syncRangeFromNumber(buyRange, buyPriceInput);
    if (shouldUpdate !== false) {
      update();
    }
  }

  function buildShareUrl() {
    var url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("plan", "1");
    var values = captureFormValues();
    Object.keys(SHARE_FIELDS).forEach(function (key) {
      url.searchParams.set(SHARE_FIELDS[key], compactNumber(values[key]));
    });
    Object.keys(SHARE_TEXT_FIELDS).forEach(function (key) {
      if (values[key]) {
        url.searchParams.set(SHARE_TEXT_FIELDS[key], values[key]);
      }
    });
    url.searchParams.set("fm", feeSettings.mode);
    url.searchParams.set("sec", feeSettings.securityType);
    url.searchParams.set("cr", compactNumber(feeSettings.commissionRate));
    url.searchParams.set("mc", compactNumber(feeSettings.minimumCommission));
    url.searchParams.set("msf", compactNumber(feeSettings.manualSellFee));
    url.searchParams.set("mbf", compactNumber(feeSettings.manualBuyFee));
    url.searchParams.set("sd", feeSettings.includeStampDuty ? "1" : "0");
    url.searchParams.set("st", feeSettings.includeSettlementFee ? "1" : "0");
    return url.toString();
  }

  function shareCurrentPlan() {
    if (!latestInput || !latestResult) {
      showCopyToast("请先修正输入内容", true);
      return;
    }
    copyText(buildShareUrl(), "分享链接已复制");
  }

  function loadSharedState() {
    try {
      var params = new URL(window.location.href).searchParams;
      if (params.get("plan") !== "1") {
        return false;
      }
      var values = {};
      var validFields = 0;
      Object.keys(SHARE_FIELDS).forEach(function (key) {
        var raw = params.get(SHARE_FIELDS[key]);
        if (raw !== null && Number.isFinite(Number(raw))) {
          values[key] = Number(raw);
          validFields += 1;
        } else {
          values[key] = DEFAULTS[key];
        }
      });
      if (validFields === 0) {
        return false;
      }
      Object.keys(SHARE_TEXT_FIELDS).forEach(function (key) {
        values[key] = params.get(SHARE_TEXT_FIELDS[key]) || TEXT_DEFAULTS[key];
      });
      var sharedSettings = normalizedFeeSettings({
        mode: params.get("fm"),
        securityType: params.get("sec"),
        commissionRate: params.get("cr"),
        minimumCommission: params.get("mc"),
        includeStampDuty: params.get("sd") !== "0",
        includeSettlementFee: params.get("st") !== "0",
        manualSellFee: params.get("msf") !== null ? params.get("msf") : values.sellFee,
        manualBuyFee: params.get("mbf") !== null ? params.get("mbf") : values.buyFee
      });
      setCalculatorState(values, sharedSettings, false);
      return true;
    } catch (error) {
      return false;
    }
  }

  function scenarioSnapshot() {
    return {
      values: captureFormValues(),
      feeSettings: Object.assign({}, feeSettings),
      savedAt: Date.now()
    };
  }

  function normalizedScenario(source) {
    if (!source || typeof source !== "object" || !source.values) {
      return null;
    }
    var values = {};
    var valid = true;
    Object.keys(DEFAULTS).forEach(function (key) {
      if (!Number.isFinite(Number(source.values[key]))) {
        valid = false;
      } else {
        values[key] = Number(source.values[key]);
      }
    });
    values.stockCode = normalizedStockCode(source.values.stockCode);
    values.stockName = String(source.values.stockName || "").trim();
    return valid ? {
      values: values,
      feeSettings: normalizedFeeSettings(source.feeSettings),
      savedAt: Number(source.savedAt) || 0
    } : null;
  }

  function normalizedScenarios(source) {
    return {
      A: normalizedScenario(source && source.A),
      B: normalizedScenario(source && source.B)
    };
  }

  function loadLegacyScenarios() {
    try {
      var saved = JSON.parse(localStorage.getItem(SCENARIO_STORAGE_KEY));
      scenarios = normalizedScenarios(saved);
    } catch (error) {
      scenarios = { A: null, B: null };
    }
    updateScenarioCount();
  }

  function normalizeHoldingRecord(source) {
    if (!source || typeof source !== "object" || !source.id || !source.values) {
      return null;
    }
    var values = {};
    var valid = true;
    Object.keys(DEFAULTS).forEach(function (key) {
      if (!Number.isFinite(Number(source.values[key]))) {
        valid = false;
      } else {
        values[key] = Number(source.values[key]);
      }
    });
    if (!valid) {
      return null;
    }
    values.stockCode = normalizedStockCode(source.values.stockCode);
    values.stockName = String(source.values.stockName || "").trim();
    return {
      id: String(source.id),
      values: values,
      feeSettings: normalizedFeeSettings(source.feeSettings),
      scenarios: normalizedScenarios(source.scenarios),
      updatedAt: Number(source.updatedAt) || Date.now()
    };
  }

  function loadHoldingRecords() {
    try {
      var saved = JSON.parse(localStorage.getItem(HOLDINGS_STORAGE_KEY));
      holdingRecords = Array.isArray(saved)
        ? saved.map(normalizeHoldingRecord).filter(Boolean)
        : [];
    } catch (error) {
      holdingRecords = [];
    }
    updateHoldingCount();
  }

  function persistHoldingRecords() {
    try {
      localStorage.setItem(HOLDINGS_STORAGE_KEY, JSON.stringify(holdingRecords));
      if (currentRecordId) {
        localStorage.setItem(CURRENT_HOLDING_STORAGE_KEY, currentRecordId);
      } else {
        localStorage.removeItem(CURRENT_HOLDING_STORAGE_KEY);
      }
    } catch (error) {
      // The current calculation remains usable if browser storage is unavailable.
    }
    updateHoldingCount();
  }

  function findHoldingRecord(id) {
    return holdingRecords.find(function (record) { return record.id === id; }) || null;
  }

  function holdingStateSignature(values, settings, scenarioState) {
    return JSON.stringify({
      values: values,
      feeSettings: normalizedFeeSettings(settings),
      scenarios: normalizedScenarios(scenarioState)
    });
  }

  function currentStateSignature() {
    return holdingStateSignature(captureFormValues(), feeSettings, scenarios);
  }

  function hasMeaningfulCurrentState() {
    var values = captureFormValues();
    if (values.stockCode || values.stockName) {
      return true;
    }
    return ["currentShares", "currentCost", "marketPrice", "sellShares", "sellPrice", "buyShares", "buyPrice", "targetCost"]
      .some(function (key) { return Math.abs(Number(values[key]) || 0) > 0.000001; })
      || Boolean(scenarios.A || scenarios.B);
  }

  function isCurrentDirty() {
    if (currentRecordId && savedRecordSignature) {
      return currentStateSignature() !== savedRecordSignature;
    }
    return hasMeaningfulCurrentState();
  }

  function updateHoldingCount() {
    setText("holdingCount", String(holdingRecords.length));
    setText("holdingBookFooter", holdingRecords.length + " 条本地持仓");
  }

  function updateSavedStateUI() {
    var dirty = isCurrentDirty();
    saveHoldingButton.classList.toggle("is-saved", Boolean(currentRecordId && !dirty));
    saveHoldingButton.classList.toggle("is-dirty", Boolean(currentRecordId && dirty));
    if (currentRecordId && !dirty) {
      setText("saveHoldingLabel", "已保存 ✓");
    } else if (currentRecordId) {
      setText("saveHoldingLabel", "有修改 · 保存");
    } else {
      setText("saveHoldingLabel", "保存当前");
    }
  }

  function saveScenarios() {
    var record = findHoldingRecord(currentRecordId);
    if (record) {
      record.scenarios = normalizedScenarios(scenarios);
      record.updatedAt = Date.now();
      savedRecordSignature = holdingStateSignature(record.values, record.feeSettings, record.scenarios);
      persistHoldingRecords();
    } else {
      try {
        localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(scenarios));
      } catch (error) {
        // Scenario comparison still works for the current session.
      }
    }
    updateScenarioCount();
    updateSavedStateUI();
  }

  function updateScenarioCount() {
    var count = (scenarios.A ? 1 : 0) + (scenarios.B ? 1 : 0);
    setText("scenarioCount", count + "/2");
  }

  function scenarioCalculation(snapshot) {
    if (!snapshot) {
      return null;
    }
    var input = inputFromState(snapshot.values, snapshot.feeSettings);
    var result = calculateCosts(input);
    return result.error ? null : { input: input, result: result };
  }

  function scenarioCashText(value) {
    if (Math.abs(value) < 0.005) {
      return "持平";
    }
    return value > 0 ? "收回 " + formatMoney(value) : "投入 " + formatMoney(Math.abs(value));
  }

  function renderScenarioSlot(slot) {
    var snapshot = scenarios[slot];
    var card = document.querySelector('[data-scenario-slot="' + slot + '"]');
    var empty = element("scenarioEmpty" + slot);
    var content = element("scenarioContent" + slot);
    var calculation = scenarioCalculation(snapshot);
    var hasScenario = Boolean(snapshot && calculation);
    card.classList.toggle("has-scenario", hasScenario);
    empty.hidden = hasScenario;
    content.hidden = !hasScenario;
    setText("scenarioStatus" + slot, hasScenario ? "已保存" : "未保存");
    card.querySelector('[data-scenario-action="apply"]').disabled = !hasScenario;
    card.querySelector('[data-scenario-action="clear"]').disabled = !hasScenario;
    if (!hasScenario) {
      return null;
    }
    var input = calculation.input;
    var result = calculation.result;
    setText("scenarioOrder" + slot,
      (stockLabel(input) ? stockLabel(input) + " · " : "")
      + "买 " + formatNumber(input.buyShares, 0) + " 股 @ " + formatMoney(input.buyPrice)
      + " · 卖 " + formatNumber(input.sellShares, 0) + " 股 @ " + formatMoney(input.sellPrice));
    setText("scenarioCost" + slot, formatMoney(result.newDilutedCost));
    setText("scenarioCash" + slot, scenarioCashText(result.netCashFlow));
    setText("scenarioShares" + slot, formatNumber(result.finalShares, 0) + " 股");
    setText("scenarioFees" + slot, formatMoney(result.totalFees));
    return calculation;
  }

  function renderScenarioDialog() {
    var calculationA = renderScenarioSlot("A");
    var calculationB = renderScenarioSlot("B");
    var comparison = element("scenarioComparison");
    comparison.hidden = !(calculationA && calculationB);
    if (calculationA && calculationB) {
      var costDifference = calculationB.result.newDilutedCost - calculationA.result.newDilutedCost;
      var cashDifference = calculationB.result.netCashFlow - calculationA.result.netCashFlow;
      var costText = Math.abs(costDifference) < 0.005
        ? "回本成本持平"
        : "回本成本" + (costDifference < 0 ? "低 " : "高 ") + formatMoney(Math.abs(costDifference));
      setText("scenarioComparisonText", costText + "；净资金流差 " + formatSignedMoney(cashDifference));
    }
    updateScenarioCount();
  }

  function handleScenarioAction(action, slot) {
    if (slot !== "A" && slot !== "B") {
      return;
    }
    if (action === "save") {
      if (!latestInput || !latestResult) {
        showCopyToast("请先修正输入内容", true);
        return;
      }
      scenarios[slot] = scenarioSnapshot();
      saveScenarios();
      renderScenarioDialog();
      showCopyToast("方案 " + slot + " 已保存", false);
    } else if (action === "apply" && scenarios[slot]) {
      setCalculatorState(scenarios[slot].values, scenarios[slot].feeSettings, true);
      closeDialog(scenarioDialog);
      showCopyToast("已载入方案 " + slot, false);
    } else if (action === "clear") {
      scenarios[slot] = null;
      saveScenarios();
      renderScenarioDialog();
    }
  }

  function backupPayload() {
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      product: "costbuddy",
      exportedAt: new Date().toISOString(),
      data: {
        current: {
          values: captureFormValues(),
          feeSettings: normalizedFeeSettings(feeSettings),
          scenarios: normalizedScenarios(scenarios),
          recordId: currentRecordId
        },
        holdings: holdingRecords
      }
    };
  }

  function backupFileName() {
    var date = new Date();
    function pad(value) { return String(value).padStart(2, "0"); }
    return "costbuddy-backup-" + date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + ".json";
  }

  function exportBackup() {
    try {
      var content = JSON.stringify(backupPayload(), null, 2);
      var url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
      var link = document.createElement("a");
      link.href = url;
      link.download = backupFileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      showCopyToast("备份已导出", false);
    } catch (error) {
      showCopyToast("备份导出失败，请稍后重试", true);
    }
  }

  function normalizeBackupPayload(source) {
    if (!source || typeof source !== "object" || source.format !== BACKUP_FORMAT
        || Number(source.version) !== BACKUP_VERSION || !source.data || typeof source.data !== "object") {
      throw new Error("unsupported-backup");
    }
    var currentSource = source.data.current;
    var normalizedCurrent = normalizeHoldingRecord({
      id: "backup-current",
      values: currentSource && currentSource.values,
      feeSettings: currentSource && currentSource.feeSettings,
      scenarios: currentSource && currentSource.scenarios,
      updatedAt: Date.now()
    });
    if (!normalizedCurrent) {
      throw new Error("invalid-current-state");
    }
    var rawHoldings = Array.isArray(source.data.holdings) ? source.data.holdings : [];
    var normalizedHoldings = rawHoldings.map(normalizeHoldingRecord).filter(Boolean);
    var uniqueIds = new Set(normalizedHoldings.map(function (record) { return record.id; }));
    if (normalizedHoldings.length !== rawHoldings.length || uniqueIds.size !== normalizedHoldings.length) {
      throw new Error("invalid-holdings");
    }
    normalizedHoldings.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    var requestedRecordId = currentSource && currentSource.recordId ? String(currentSource.recordId) : null;
    var linkedRecordId = requestedRecordId && uniqueIds.has(requestedRecordId) ? requestedRecordId : null;
    return {
      exportedAt: Number.isFinite(Date.parse(source.exportedAt)) ? Date.parse(source.exportedAt) : 0,
      holdings: normalizedHoldings,
      current: {
        values: normalizedCurrent.values,
        feeSettings: normalizedCurrent.feeSettings,
        scenarios: normalizedCurrent.scenarios,
        recordId: linkedRecordId
      }
    };
  }

  function previewBackupImport(backup) {
    pendingImportBackup = backup;
    var timeText = backup.exportedAt ? formatHoldingTime(backup.exportedAt) + " 导出" : "未记录导出时间";
    setText("importBackupSummary", "备份包含 " + backup.holdings.length + " 条持仓 · " + timeText);
    openDialog(importBackupDialog);
  }

  function readBackupFile(file) {
    if (!file) {
      return;
    }
    if (file.size > MAX_BACKUP_FILE_SIZE) {
      showCopyToast("备份文件过大，无法导入", true);
      return;
    }
    file.text().then(function (content) {
      previewBackupImport(normalizeBackupPayload(JSON.parse(content)));
    }).catch(function () {
      pendingImportBackup = null;
      showCopyToast("无法读取备份，请选择 costbuddy 导出的 JSON 文件", true);
    });
  }

  function applyImportedBackup() {
    if (!pendingImportBackup) {
      return;
    }
    var backup = pendingImportBackup;
    pendingImportBackup = null;
    holdingRecords = backup.holdings.slice();
    currentRecordId = backup.current.recordId;
    scenarios = normalizedScenarios(backup.current.scenarios);
    var linkedRecord = findHoldingRecord(currentRecordId);
    savedRecordSignature = linkedRecord
      ? holdingStateSignature(linkedRecord.values, linkedRecord.feeSettings, linkedRecord.scenarios)
      : null;
    pendingDeleteId = null;
    persistHoldingRecords();
    try {
      localStorage.removeItem(SCENARIO_STORAGE_KEY);
    } catch (error) {
      // Ignore unavailable legacy-storage cleanup.
    }
    setCalculatorState(backup.current.values, backup.current.feeSettings, true);
    updateScenarioCount();
    updateSavedStateUI();
    renderHoldingBook();
    closeDialog(importBackupDialog);
    showCopyToast("已导入 " + holdingRecords.length + " 条持仓", false);
  }

  function createHoldingId() {
    return "holding-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function saveCurrentHolding() {
    if (!latestInput || !latestResult) {
      showCopyToast("请先修正输入内容", true);
      return false;
    }
    if (!latestInput.stockCode && !latestInput.stockName) {
      showCopyToast("请先填写股票代码或名称", true);
      element("stockCode").focus();
      return false;
    }
    var record = findHoldingRecord(currentRecordId);
    if (!record) {
      record = { id: createHoldingId() };
      currentRecordId = record.id;
      holdingRecords.push(record);
    }
    record.values = captureFormValues();
    record.feeSettings = normalizedFeeSettings(feeSettings);
    record.scenarios = normalizedScenarios(scenarios);
    record.updatedAt = Date.now();
    holdingRecords.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    savedRecordSignature = holdingStateSignature(record.values, record.feeSettings, record.scenarios);
    persistHoldingRecords();
    try {
      localStorage.removeItem(SCENARIO_STORAGE_KEY);
    } catch (error) {
      // Ignore unavailable storage cleanup.
    }
    updateSavedStateUI();
    renderHoldingBook();
    showCopyToast("已保存到持仓簿", false);
    return true;
  }

  function holdingCalculation(record) {
    var input = inputFromState(record.values, record.feeSettings);
    var result = calculateCosts(input);
    return result.error ? null : { input: input, result: result };
  }

  function formatHoldingTime(timestamp) {
    var date = new Date(timestamp);
    function pad(value) { return String(value).padStart(2, "0"); }
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
      + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
  }

  function renderHoldingBook() {
    holdingList.replaceChildren();
    holdingEmpty.hidden = holdingRecords.length > 0;
    holdingRecords.forEach(function (record) {
      var calculation = holdingCalculation(record);
      var card = document.createElement("article");
      var isCurrent = record.id === currentRecordId;
      card.className = "holding-card" + (isCurrent ? " is-current" : "");
      card.dataset.recordId = record.id;
      card.innerHTML = ""
        + '<div class="holding-card-header">'
        + '  <div class="holding-card-title"><strong data-field="code"></strong><span data-field="name"></span></div>'
        + '  <span class="holding-card-status" data-field="status"></span>'
        + '</div>'
        + '<div class="holding-card-metrics">'
        + '  <div><span>目前持仓</span><strong data-field="shares"></strong></div>'
        + '  <div><span>目前成本</span><strong data-field="cost"></strong></div>'
        + '  <div><span>当前股价</span><strong data-field="price"></strong></div>'
        + '  <div><span>资金回本成本</span><strong data-field="basis"></strong></div>'
        + '</div>'
        + '<div class="holding-card-footer">'
        + '  <time data-field="time"></time>'
        + '  <div class="holding-card-actions">'
        + '    <button type="button" data-holding-action="load">继续测算</button>'
        + '    <button class="holding-delete-button" type="button" data-holding-action="delete">删除</button>'
        + '  </div>'
        + '</div>';
      card.querySelector('[data-field="code"]').textContent = record.values.stockCode || "未填写代码";
      card.querySelector('[data-field="name"]').textContent = record.values.stockName || "未命名持仓";
      card.querySelector('[data-field="status"]').textContent = isCurrent
        ? (isCurrentDirty() ? "正在编辑 · 有修改" : "正在编辑")
        : "已保存";
      card.querySelector('[data-field="shares"]').textContent = formatNumber(record.values.currentShares, 0) + " 股";
      card.querySelector('[data-field="cost"]').textContent = formatMoney(record.values.currentCost);
      card.querySelector('[data-field="price"]').textContent = formatMoney(record.values.marketPrice);
      card.querySelector('[data-field="basis"]').textContent = calculation
        ? formatMoney(calculation.result.newDilutedCost)
        : "—";
      card.querySelector('[data-field="time"]').textContent = formatHoldingTime(record.updatedAt) + " 更新";
      if (pendingDeleteId === record.id) {
        var deleteButton = card.querySelector('[data-holding-action="delete"]');
        deleteButton.textContent = "确认删除";
        deleteButton.classList.add("is-confirming");
      }
      holdingList.appendChild(card);
    });
    updateHoldingCount();
  }

  function loadHoldingRecord(recordId) {
    var record = findHoldingRecord(recordId);
    if (!record) {
      return;
    }
    currentRecordId = record.id;
    scenarios = normalizedScenarios(record.scenarios);
    savedRecordSignature = holdingStateSignature(record.values, record.feeSettings, record.scenarios);
    pendingDeleteId = null;
    persistHoldingRecords();
    setCalculatorState(record.values, record.feeSettings, true);
    updateScenarioCount();
    updateSavedStateUI();
    closeDialog(holdingBookDialog);
    showCopyToast("已载入 " + (stockLabel(record.values) || "该持仓"), false);
  }

  function deleteHoldingRecord(recordId) {
    holdingRecords = holdingRecords.filter(function (record) { return record.id !== recordId; });
    if (currentRecordId === recordId) {
      currentRecordId = null;
      savedRecordSignature = null;
    }
    pendingDeleteId = null;
    persistHoldingRecords();
    updateSavedStateUI();
    renderHoldingBook();
    showCopyToast("持仓记录已删除", false);
  }

  function startNewMeasurement() {
    var nextFeeSettings = normalizedFeeSettings(feeSettings);
    nextFeeSettings.manualSellFee = 0;
    nextFeeSettings.manualBuyFee = 0;
    currentRecordId = null;
    savedRecordSignature = null;
    pendingDeleteId = null;
    scenarios = { A: null, B: null };
    persistHoldingRecords();
    setCalculatorState(NEW_MEASUREMENT_VALUES, nextFeeSettings, true);
    updateScenarioCount();
    updateSavedStateUI();
    closeDialog(holdingBookDialog);
    closeDialog(unsavedDialog);
    element("stockCode").focus();
    showCopyToast("已新建空白测算", false);
  }

  function performPendingUnsavedAction() {
    var action = pendingUnsavedAction;
    pendingUnsavedAction = null;
    if (!action || action.type === "new") {
      startNewMeasurement();
    } else if (action.type === "load") {
      loadHoldingRecord(action.recordId);
    }
  }

  function requestMeasurementAction(action) {
    if (action.type === "load" && action.recordId === currentRecordId) {
      closeDialog(holdingBookDialog);
      return;
    }
    if (!isCurrentDirty()) {
      pendingUnsavedAction = action;
      performPendingUnsavedAction();
      return;
    }
    pendingUnsavedAction = action;
    var isNew = action.type === "new";
    setText("unsavedPromptTitle", isNew ? "要先保存这只股票吗？" : "切换持仓前，要保存当前修改吗？");
    setText("unsavedPromptText", isNew
      ? "保存后可在持仓簿继续测算；不保存则会清空当前参数。"
      : "保存后再切换到所选持仓；不保存将放弃当前修改。");
    setText("discardAndContinueButton", isNew ? "不保存，直接新建" : "不保存，直接切换");
    setText("saveAndContinueButton", isNew ? "保存并新建" : "保存并切换");
    openDialog(unsavedDialog);
  }

  function restoreCurrentHoldingLink() {
    try {
      var savedId = localStorage.getItem(CURRENT_HOLDING_STORAGE_KEY);
      var record = findHoldingRecord(savedId);
      if (!record) {
        loadLegacyScenarios();
        return;
      }
      currentRecordId = record.id;
      scenarios = normalizedScenarios(record.scenarios);
      savedRecordSignature = holdingStateSignature(record.values, record.feeSettings, record.scenarios);
    } catch (error) {
      currentRecordId = null;
      savedRecordSignature = null;
      loadLegacyScenarios();
    }
  }

  function saveInputs(input) {
    try {
      var saved = Object.assign({}, input, {
        feeSettings: undefined,
        _feeSettings: Object.assign({}, feeSettings)
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch (error) {
      // The calculator remains usable when storage is unavailable.
    }
  }

  function loadInputs() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || typeof saved !== "object") {
        return;
      }
      Object.keys(DEFAULTS).forEach(function (key) {
        if (Number.isFinite(Number(saved[key]))) {
          element(key).value = saved[key];
        }
      });
      element("stockCode").value = normalizedStockCode(saved.stockCode);
      element("stockName").value = String(saved.stockName || "").trim();
      var savedFeeSettings = saved._feeSettings || saved.feeSettings;
      if (savedFeeSettings && typeof savedFeeSettings === "object") {
        feeSettings.mode = savedFeeSettings.mode === "auto" ? "auto" : "manual";
        feeSettings.securityType = ["stock", "stamp-exempt", "custom"].indexOf(savedFeeSettings.securityType) >= 0
          ? savedFeeSettings.securityType
          : (savedFeeSettings.includeStampDuty === false ? "stamp-exempt" : "stock");
        ["commissionRate", "minimumCommission", "manualSellFee", "manualBuyFee"].forEach(function (key) {
          if (Number.isFinite(Number(savedFeeSettings[key]))) {
            feeSettings[key] = Number(savedFeeSettings[key]);
          }
        });
        feeSettings.includeStampDuty = savedFeeSettings.includeStampDuty !== false;
        if (feeSettings.securityType === "stock") {
          feeSettings.includeStampDuty = true;
        } else if (feeSettings.securityType === "stamp-exempt") {
          feeSettings.includeStampDuty = false;
        }
        feeSettings.includeSettlementFee = savedFeeSettings.includeSettlementFee !== false;
      } else {
        feeSettings.manualSellFee = Number.isFinite(Number(saved.sellFee))
          ? Number(saved.sellFee)
          : DEFAULT_FEE_SETTINGS.manualSellFee;
        feeSettings.manualBuyFee = Number.isFinite(Number(saved.buyFee))
          ? Number(saved.buyFee)
          : DEFAULT_FEE_SETTINGS.manualBuyFee;
      }
      if (feeSettings.mode === "manual") {
        element("sellFee").value = feeSettings.manualSellFee;
        element("buyFee").value = feeSettings.manualBuyFee;
      }
    } catch (error) {
      // Invalid or unavailable storage falls back to the example values.
    }
  }

  function syncRangeFromNumber(range, numberInput) {
    range.value = Math.max(Number(range.min), Math.min(Number(range.max), Number(numberInput.value) || 0));
  }

  function updateRangeVisual(range) {
    var min = Number(range.min) || 0;
    var max = Number(range.max) || 100;
    var value = Number(range.value) || 0;
    var ratio = max > min ? (value - min) / (max - min) * 100 : 0;
    var fill = Math.max(0, Math.min(100, ratio)).toFixed(2) + "%";
    if (range.style && typeof range.style.setProperty === "function") {
      range.style.setProperty("--fill", fill);
    } else if (range.style) {
      range.style["--fill"] = fill;
    }
  }

  function update() {
    var input = getInputs();
    var result = calculateCosts(input);

    setText("sellLots", input.lotSize > 0 ? (input.sellShares / input.lotSize).toFixed(2) + " 手" : "— 手");
    setText("buyLots", input.lotSize > 0 ? (input.buyShares / input.lotSize).toFixed(2) + " 手" : "— 手");
    setText("sellPriceOutput", formatMoney(input.sellPrice));
    setText("buyPriceOutput", formatMoney(input.buyPrice));
    updateDocumentTitle(input);
    updateRangeVisual(sellRange);
    updateRangeVisual(buyRange);

    if (result.error) {
      var isEmptyState = !hasMeaningfulCurrentState();
      latestInput = null;
      latestResult = null;
      copyResultButton.disabled = true;
      if (isEmptyState) {
        hideError();
      } else {
        showError(result.error);
      }
      renderUnavailable(isEmptyState);
      saveInputs(input);
      updateSavedStateUI();
      return;
    }
    hideError();
    latestInput = input;
    latestResult = result;
    copyResultButton.disabled = false;
    setText("calculationBadge", input.feeMode === "auto" ? "费用自动估算" : "已含双边费用");

    setText("newDilutedCost", result.newDilutedCost.toFixed(2));
    setText("finalShares", formatNumber(result.finalShares, 0) + " 股");
    setText("recoverableCost", formatMoney(result.recoverableCost));
    setText("totalPnl", formatSignedMoney(result.totalPnl));
    element("totalPnl").className = result.totalPnl >= 0 ? "positive" : "negative";
    setText("pnlIcon", result.totalPnl >= 0 ? "盈" : "损");
    element("pnlIcon").className = "metric-icon pnl-icon " + (result.totalPnl >= 0 ? "positive" : "negative");
    setText("breakEvenGap", result.breakEvenGap === null
      ? "—"
      : (result.breakEvenGap >= 0 ? "+" : "") + result.breakEvenGap.toFixed(2) + "%");
    setText("costChange", Math.abs(result.costDelta) < 0.005
      ? "与目前成本基本持平"
      : "较目前成本" + (result.costDelta < 0 ? "下降 " : "上升 ") + formatMoney(Math.abs(result.costDelta)) + " / 股");
    element("costChange").className = "cost-change "
      + (Math.abs(result.costDelta) < 0.005 ? "cost-neutral" : (result.costDelta < 0 ? "cost-lower" : "cost-higher"));
    updateResultInsight(input, result);
    element("breakEvenGap").className = result.breakEvenGap !== null && result.breakEvenGap <= 0 ? "positive" : "negative";

    if (Math.abs(result.netCashFlow) < 0.005) {
      setText("netCashFlow", "现金流持平");
      element("netCashFlow").className = "";
    } else if (result.netCashFlow > 0) {
      setText("netCashFlow", "净收回 " + formatMoney(result.netCashFlow));
      element("netCashFlow").className = "positive";
    } else {
      setText("netCashFlow", "净投入 " + formatMoney(Math.abs(result.netCashFlow)));
      element("netCashFlow").className = "negative";
    }

    setText("originalBasis", formatMoney(result.originalBasis));
    setText("netSaleProceeds", (result.netSaleProceeds >= 0 ? "−" : "+") + formatMoney(Math.abs(result.netSaleProceeds)));
    setText("buyOutlay", "+" + formatMoney(result.buyOutlay));
    setText("totalFees", formatMoney(result.totalFees));
    setText("formulaText",
      "(" + compactNumber(input.currentShares) + " × " + compactNumber(input.currentCost)
      + " − (" + compactNumber(input.sellShares) + " × " + compactNumber(input.sellPrice) + " − " + compactNumber(result.appliedSellFee) + ")"
      + " + (" + compactNumber(input.buyShares) + " × " + compactNumber(input.buyPrice) + " + " + compactNumber(result.appliedBuyFee) + "))"
      + " ÷ " + compactNumber(result.finalShares) + " = " + result.newDilutedCost.toFixed(2)
    );

    updateStages(input, result);
    renderTargetPlan(input, result);
    renderPlanComparison(input, result);
    updatePricePosition(input, result);
    drawChart(input, result);
    if (feeDialog.open || feeDialog.hasAttribute("open")) {
      refreshFeeDialog();
    }
    saveInputs(input);
    updateSavedStateUI();
  }

  sellRange.addEventListener("input", function () {
    sellPriceInput.value = sellRange.value;
    update();
  });
  sellPriceInput.addEventListener("input", function () {
    syncRangeFromNumber(sellRange, sellPriceInput);
    update();
  });
  buyRange.addEventListener("input", function () {
    buyPriceInput.value = buyRange.value;
    update();
  });
  buyPriceInput.addEventListener("input", function () {
    syncRangeFromNumber(buyRange, buyPriceInput);
    update();
  });
  targetCostInput.addEventListener("input", function () {
    update();
  });
  form.addEventListener("input", function (event) {
    cancelResetConfirmation();
    if (event.target !== sellRange && event.target !== buyRange
      && event.target !== sellPriceInput && event.target !== buyPriceInput) {
      update();
    }
  });
  resetButton.addEventListener("click", function () {
    if (!resetArmed) {
      armResetConfirmation();
      return;
    }
    cancelResetConfirmation();
    restoreExample();
  });
  applyTargetPlanButton.addEventListener("click", function () {
    if (!latestTargetPlan) {
      return;
    }
    element("buyShares").value = latestTargetPlan.lotShares;
    update();
  });
  comparisonBody.addEventListener("click", function (event) {
    var button = event.target.closest("button[data-shares]");
    if (!button) {
      return;
    }
    element("buyShares").value = button.dataset.shares;
    update();
  });

  basisInfoButton.addEventListener("click", function () {
    openDialog(basisDialog);
  });
  feeSettingsButton.addEventListener("click", function () {
    if (feeSettings.mode === "manual") {
      feeSettings.manualSellFee = numberValue("sellFee");
      feeSettings.manualBuyFee = numberValue("buyFee");
    }
    syncFeeDialog();
    openDialog(feeDialog);
  });
  feeDialog.addEventListener("input", function (event) {
    if (event.target.id === "includeStampDuty") {
      var customSecurityType = document.querySelector('input[name="securityType"][value="custom"]');
      if (customSecurityType) {
        customSecurityType.checked = true;
      }
    }
    syncSecurityTypePreset();
    refreshFeeDialog();
  });
  element("applyFeeSettings").addEventListener("click", applyFeeSettingsFromDialog);
  saveHoldingButton.addEventListener("click", saveCurrentHolding);
  holdingBookButton.addEventListener("click", function () {
    pendingDeleteId = null;
    renderHoldingBook();
    openDialog(holdingBookDialog);
  });
  newMeasurementButton.addEventListener("click", function () {
    requestMeasurementAction({ type: "new" });
  });
  holdingBookNewButton.addEventListener("click", function () {
    requestMeasurementAction({ type: "new" });
  });
  exportBackupButton.addEventListener("click", exportBackup);
  importBackupButton.addEventListener("click", function () {
    backupFileInput.click();
  });
  backupFileInput.addEventListener("change", function () {
    var file = backupFileInput.files && backupFileInput.files[0];
    backupFileInput.value = "";
    readBackupFile(file);
  });
  importBackupDialog.addEventListener("cancel", function () {
    pendingImportBackup = null;
  });
  importBackupDialog.addEventListener("click", function (event) {
    var actionButton = event.target.closest("button[data-import-action]");
    if (!actionButton) {
      if (event.target === importBackupDialog) {
        pendingImportBackup = null;
        closeDialog(importBackupDialog);
      }
      return;
    }
    if (actionButton.dataset.importAction === "confirm") {
      applyImportedBackup();
    } else {
      pendingImportBackup = null;
      closeDialog(importBackupDialog);
    }
  });
  holdingList.addEventListener("click", function (event) {
    var actionButton = event.target.closest("button[data-holding-action]");
    var card = event.target.closest("[data-record-id]");
    if (!actionButton || !card) {
      return;
    }
    var recordId = card.dataset.recordId;
    if (actionButton.dataset.holdingAction === "load") {
      pendingDeleteId = null;
      requestMeasurementAction({ type: "load", recordId: recordId });
    } else if (actionButton.dataset.holdingAction === "delete") {
      if (pendingDeleteId === recordId) {
        deleteHoldingRecord(recordId);
      } else {
        pendingDeleteId = recordId;
        renderHoldingBook();
      }
    }
  });
  unsavedDialog.addEventListener("cancel", function () {
    pendingUnsavedAction = null;
  });
  unsavedDialog.addEventListener("click", function (event) {
    var actionButton = event.target.closest("button[data-unsaved-action]");
    if (!actionButton) {
      if (event.target === unsavedDialog) {
        pendingUnsavedAction = null;
        closeDialog(unsavedDialog);
      }
      return;
    }
    var action = actionButton.dataset.unsavedAction;
    if (action === "cancel") {
      pendingUnsavedAction = null;
      closeDialog(unsavedDialog);
    } else if (action === "discard") {
      closeDialog(unsavedDialog);
      performPendingUnsavedAction();
    } else if (action === "save" && saveCurrentHolding()) {
      closeDialog(unsavedDialog);
      performPendingUnsavedAction();
    }
  });
  copyResultButton.addEventListener("click", copyCurrentResult);
  sharePlanButton.addEventListener("click", shareCurrentPlan);
  scenarioButton.addEventListener("click", function () {
    renderScenarioDialog();
    openDialog(scenarioDialog);
  });
  scenarioDialog.addEventListener("click", function (event) {
    var actionButton = event.target.closest("button[data-scenario-action]");
    if (actionButton) {
      handleScenarioAction(actionButton.dataset.scenarioAction, actionButton.dataset.slot);
    }
  });

  element("stockCode").addEventListener("blur", function () {
    element("stockCode").value = normalizedStockCode(element("stockCode").value);
    update();
  });
  document.addEventListener("click", function (event) {
    if (resetArmed && !event.target.closest("#resetButton")) {
      cancelResetConfirmation();
    }
    if (pendingDeleteId && !event.target.closest("[data-holding-action=\"delete\"]")) {
      pendingDeleteId = null;
      if (holdingBookDialog.open || holdingBookDialog.hasAttribute("open")) {
        renderHoldingBook();
      }
    }
  });

  document.querySelectorAll("[data-close-dialog]").forEach(function (button) {
    button.addEventListener("click", function () {
      closeDialog(button.closest("dialog"));
    });
  });
  [basisDialog, feeDialog, scenarioDialog, holdingBookDialog].forEach(function (dialog) {
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) {
        closeDialog(dialog);
      }
    });
  });

  loadHoldingRecords();
  var loadedSharedState = loadSharedState();
  if (loadedSharedState) {
    currentRecordId = null;
    savedRecordSignature = null;
    scenarios = { A: null, B: null };
    persistHoldingRecords();
  } else {
    loadInputs();
    restoreCurrentHoldingLink();
  }
  syncRangeFromNumber(sellRange, sellPriceInput);
  syncRangeFromNumber(buyRange, buyPriceInput);
  update();
  updateScenarioCount();
  updateHoldingCount();
  updateSavedStateUI();
  if (loadedSharedState) {
    showCopyToast("已载入分享方案", false);
  }

  window.HKDilutedCostCalculator = {
    calculateCosts: calculateCosts,
    calculateTargetPlan: calculateTargetPlan,
    calculateLotPlans: calculateLotPlans,
    calculateEstimatedFee: calculateEstimatedFee,
    buildShareUrl: buildShareUrl
  };
}());
