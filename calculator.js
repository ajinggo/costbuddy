(function () {
  "use strict";

  var STORAGE_KEY = "hk-diluted-cost-calculator-v1";
  var SCENARIO_STORAGE_KEY = "hk-diluted-cost-calculator-scenarios-v1";
  var HOLDINGS_STORAGE_KEY = "hk-diluted-cost-calculator-holdings-v1";
  var CURRENT_HOLDING_STORAGE_KEY = "hk-diluted-cost-calculator-current-holding-v1";
  var THEME_STORAGE_KEY = "costbuddy-theme-v1";
  var BACKUP_FORMAT = "costbuddy-backup";
  var BACKUP_VERSION = 2;
  var MAX_BACKUP_FILE_SIZE = 2 * 1024 * 1024;
  var WORKSPACE_MIN_WIDTH = 1040;
  var WORKSPACE_MIN_HEIGHT = 660;
  var MOBILE_LAYOUT_QUERY = "(max-width: 820px), (max-height: 520px) and (pointer: coarse)";
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
  var MARKET_CONFIGS = {
    hk: {
      code: "hk",
      name: "港股",
      shortName: "HK",
      currency: "HKD",
      symbol: "HK$",
      locale: "zh-HK",
      quantityMode: "lot",
      quantityStep: 100,
      rangeMax: 200,
      planQuantities: [1, 2, 3, 4, 5],
      defaults: {
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
      }
    },
    us: {
      code: "us",
      name: "美股",
      shortName: "US",
      currency: "USD",
      symbol: "$",
      locale: "en-US",
      quantityMode: "share",
      quantityStep: 1,
      rangeMax: 500,
      planQuantities: [1, 5, 10, 25, 50],
      defaults: {
        currentShares: 100,
        currentCost: 185.2,
        marketPrice: 172.6,
        lotSize: 1,
        sellShares: 10,
        sellPrice: 190,
        sellFee: 0.02,
        buyShares: 20,
        buyPrice: 165,
        buyFee: 0,
        targetCost: 178
      }
    }
  };
  var DEFAULTS = Object.assign({}, MARKET_CONFIGS.hk.defaults);
  var DEFAULT_FEE_SETTINGS = {
    mode: "manual",
    securityType: "stock",
    commissionRate: 0.03,
    minimumCommission: 3,
    includeStampDuty: true,
    includeSettlementFee: true,
    includeSecFee: false,
    includeFinraTaf: false,
    secRatePerMillion: 20.6,
    finraTafRate: 0.000195,
    finraTafMax: 9.79,
    manualSellFee: 18.5,
    manualBuyFee: 18.5
  };
  var US_DEFAULT_FEE_SETTINGS = {
    mode: "manual",
    securityType: "us-stock",
    commissionRate: 0,
    minimumCommission: 0,
    includeStampDuty: false,
    includeSettlementFee: false,
    includeSecFee: true,
    includeFinraTaf: true,
    secRatePerMillion: 20.6,
    finraTafRate: 0.000195,
    finraTafMax: 9.79,
    manualSellFee: 0.02,
    manualBuyFee: 0
  };
  var currentMarket = "hk";
  var lastHkLotSize = MARKET_CONFIGS.hk.quantityStep;

  var form = document.getElementById("calculatorForm");
  var resetButton = document.getElementById("resetButton");
  var themeToggleButton = document.getElementById("themeToggleButton");
  var themeToggleLabel = document.getElementById("themeToggleLabel");
  var supportFeedbackButton = document.getElementById("supportFeedbackButton");
  var supportDialog = document.getElementById("supportDialog");
  var copyFeedbackEmailButton = document.getElementById("copyFeedbackEmailButton");
  var copyWechatButton = document.getElementById("copyWechatButton");
  var themeColorMeta = document.querySelector('meta[name="theme-color"]');
  var clearPlanButton = document.getElementById("clearPlanButton");
  var clearPlanMenu = document.getElementById("clearPlanMenu");
  var mobilePageButtons = document.querySelectorAll("[data-mobile-page-target]");
  var mobileResultsButton = document.getElementById("mobileResultsButton");
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
  var feeSettings = defaultFeeSettings(currentMarket);
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

  function applyTheme(theme, persist) {
    var isDark = theme === "dark";
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    themeToggleButton.setAttribute("aria-pressed", isDark ? "true" : "false");
    themeToggleButton.setAttribute("aria-label", isDark ? "切换到日间模式" : "切换到夜间模式");
    themeToggleButton.title = isDark ? "切换到日间模式" : "切换到夜间模式";
    themeToggleLabel.textContent = isDark ? "日间" : "夜间";
    themeColorMeta.setAttribute("content", isDark ? "#0f1419" : "#f5f6fb");
    if (persist) {
      try { localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light"); } catch (error) {}
    }
  }

  function normalizeMarket(value) {
    return value === "us" ? "us" : "hk";
  }

  function marketConfig(market) {
    return MARKET_CONFIGS[normalizeMarket(market || currentMarket)];
  }

  function marketDefaults(market, empty) {
    var config = marketConfig(market);
    if (!empty) {
      return Object.assign({}, config.defaults, { market: config.code });
    }
    return {
      market: config.code,
      currentShares: 0,
      currentCost: 0,
      marketPrice: 0,
      lotSize: config.quantityStep,
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
  }

  function defaultFeeSettings(market) {
    return Object.assign(
      {},
      normalizeMarket(market) === "us" ? US_DEFAULT_FEE_SETTINGS : DEFAULT_FEE_SETTINGS
    );
  }
  function fitWorkspaceToWindow() {
    var viewportWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || WORKSPACE_MIN_WIDTH);
    var viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || WORKSPACE_MIN_HEIGHT);
    var usesMobileLayout = window.matchMedia && window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
    var rootStyle = document.documentElement.style;

    if (usesMobileLayout) {
      rootStyle.setProperty("--workspace-scale", "1");
      rootStyle.setProperty("--workspace-width", "100vw");
      rootStyle.setProperty("--workspace-height", "auto");
      document.body.classList.remove("is-window-fitted");
      return;
    }

    var scale = Math.min(1, viewportWidth / WORKSPACE_MIN_WIDTH, viewportHeight / WORKSPACE_MIN_HEIGHT);
    var shouldFit = scale < 0.9995;
    var workspaceWidth = shouldFit ? viewportWidth / scale : viewportWidth;
    var workspaceHeight = shouldFit ? viewportHeight / scale : viewportHeight;

    rootStyle.setProperty("--workspace-scale", scale.toFixed(5));
    rootStyle.setProperty("--workspace-width", workspaceWidth.toFixed(2) + "px");
    rootStyle.setProperty("--workspace-height", workspaceHeight.toFixed(2) + "px");
    document.body.classList.toggle("is-window-fitted", shouldFit);
  }

  var workspaceFitFrame = 0;
  function scheduleWorkspaceFit() {
    if (workspaceFitFrame) {
      window.cancelAnimationFrame(workspaceFitFrame);
    }
    workspaceFitFrame = window.requestAnimationFrame(function () {
      workspaceFitFrame = 0;
      fitWorkspaceToWindow();
    });
  }

  function setMobilePage(page, shouldScroll) {
    var nextPage = page === "results" ? "results" : "ticket";
    document.body.setAttribute("data-mobile-page", nextPage);
    if (nextPage === "results" && clearPlanMenu && !clearPlanMenu.hidden) {
      setClearPlanMenuOpen(false);
    }
    mobilePageButtons.forEach(function (button) {
      var isActive = button.dataset.mobilePageTarget === nextPage;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    if (shouldScroll) {
      var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    }
  }

  function numberValue(id) {
    var parsed = Number(element(id).value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function textValue(id) {
    return String(element(id).value || "").trim();
  }


  function normalizedStockCode(value, market) {
    var code = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
    if (normalizeMarket(market || currentMarket) === "us") {
      return code.replace(/[^A-Z0-9.-]/g, "").slice(0, 10);
    }
    return /^\d{1,5}$/.test(code)
      ? code.padStart(5, "0")
      : code.replace(/\D/g, "").slice(0, 5);
  }
  function stockLabel(input) {
    return [input.stockCode, input.stockName].filter(Boolean).join(" ");
  }


  function securityTypeLabel(type, shortLabel, market) {
    if (normalizeMarket(market || currentMarket) === "us") {
      return shortLabel ? "美股" : "美股 · 券商与监管费用";
    }
    if (type === "stamp-exempt") {
      return shortLabel ? "豁免" : "印花税豁免证券";
    }
    if (type === "custom") {
      return "自定义";
    }
    return shortLabel ? "港股" : "普通港股";
  }

  function formatNumber(value, digits, market) {
    return Math.abs(value).toLocaleString(marketConfig(market).locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function formatMoney(value, market) {
    var config = marketConfig(market);
    return (value < 0 ? "−" : "") + config.symbol + formatNumber(value, 2, config.code);
  }

  function formatSignedMoney(value, market) {
    var config = marketConfig(market);
    return (value >= 0 ? "+" : "−") + config.symbol + formatNumber(value, 2, config.code);
  }
  function compactNumber(value) {
    return Number(value.toFixed(2)).toString();
  }

  function roundCurrency(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }


  function calculateEstimatedFee(shares, price, settings, side, market) {
    var activeMarket = normalizeMarket(market || currentMarket);
    var turnover = Math.max(0, shares) * Math.max(0, price);
    var emptyFee = {
      turnover: 0,
      commission: 0,
      stampDuty: 0,
      transactionLevy: 0,
      afrcLevy: 0,
      tradingFee: 0,
      settlementFee: 0,
      secFee: 0,
      finraTaf: 0,
      total: 0
    };
    if (turnover <= 0) {
      return emptyFee;
    }

    var commission = Math.max(
      turnover * Math.max(0, settings.commissionRate) / 100,
      Math.max(0, settings.minimumCommission)
    );

    if (activeMarket === "us") {
      var secFee = side === "sell" && settings.includeSecFee
        ? roundCurrency(turnover * Math.max(0, settings.secRatePerMillion) / 1000000)
        : 0;
      var finraTaf = side === "sell" && settings.includeFinraTaf
        ? roundCurrency(Math.min(
          Math.max(0, shares) * Math.max(0, settings.finraTafRate),
          Math.max(0, settings.finraTafMax)
        ))
        : 0;
      return Object.assign({}, emptyFee, {
        turnover: turnover,
        commission: roundCurrency(commission),
        secFee: secFee,
        finraTaf: finraTaf,
        total: roundCurrency(commission + secFee + finraTaf)
      });
    }

    var stampDuty = settings.includeStampDuty ? Math.ceil(turnover * 0.001) : 0;
    var transactionLevy = roundCurrency(turnover * 0.000027);
    var afrcLevy = roundCurrency(turnover * 0.0000015);
    var tradingFee = roundCurrency(turnover * 0.0000565);
    var settlementFee = settings.includeSettlementFee
      ? roundCurrency(turnover * 0.000042)
      : 0;
    return Object.assign({}, emptyFee, {
      turnover: turnover,
      commission: roundCurrency(commission),
      stampDuty: stampDuty,
      transactionLevy: transactionLevy,
      afrcLevy: afrcLevy,
      tradingFee: tradingFee,
      settlementFee: settlementFee,
      total: roundCurrency(
        commission + stampDuty + transactionLevy + afrcLevy + tradingFee + settlementFee
      )
    });
  }

  function getBuyFeeFor(input, shares, price) {
    return input.feeMode === "auto"
      ? calculateEstimatedFee(shares, price, input.feeSettings, "buy", input.market).total
      : input.buyFee;
  }

  function setFeeInputPresentation(isAuto) {
    ["sellFee", "buyFee"].forEach(function (id) {
      var feeInput = element(id);
      feeInput.readOnly = isAuto;
      feeInput.closest(".input-wrap").classList.toggle("is-auto-fee", isAuto);
    });
    setText("feeModeLabel", isAuto
      ? "自动·" + securityTypeLabel(feeSettings.securityType, true, currentMarket)
      : "手动");
    setText("buyFeeLabel", isAuto ? "买入费用 · 自动" : "买入费用");
    setText("sellFeeLabel", isAuto ? "卖出费用 · 自动" : "卖出费用");
    feeSettingsButton.classList.toggle("is-auto", isAuto);
  }

  function getInputs() {
    var input = {
      market: currentMarket,
      currentShares: numberValue("currentShares"),
      currentCost: numberValue("currentCost"),
      marketPrice: numberValue("marketPrice"),
      lotSize: currentMarket === "us" ? 1 : numberValue("lotSize"),
      sellShares: numberValue("sellShares"),
      sellPrice: numberValue("sellPrice"),
      sellFee: numberValue("sellFee"),
      buyShares: numberValue("buyShares"),
      buyPrice: numberValue("buyPrice"),
      buyFee: numberValue("buyFee"),
      targetCost: numberValue("targetCost"),
      stockCode: normalizedStockCode(textValue("stockCode"), currentMarket),
      stockName: textValue("stockName"),
      feeMode: feeSettings.mode,
      feeSettings: Object.assign({}, feeSettings)
    };

    if (feeSettings.mode === "auto") {
      input.sellFee = calculateEstimatedFee(
        input.sellShares, input.sellPrice, feeSettings, "sell", currentMarket
      ).total;
      input.buyFee = calculateEstimatedFee(
        input.buyShares, input.buyPrice, feeSettings, "buy", currentMarket
      ).total;
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
    var activeMarket = normalizeMarket(input.market);
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
    if (activeMarket === "hk" && input.lotSize <= 0) {
      return { error: "每手股数必须大于 0。" };
    }
    if (!Number.isInteger(input.currentShares) || !Number.isInteger(input.sellShares)
      || !Number.isInteger(input.buyShares)) {
      return { error: "买入、卖出和目前股数请填写整数。" };
    }
    if (activeMarket === "hk" && !Number.isInteger(input.lotSize)) {
      return { error: "每手股数请填写整数。" };
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
      market: activeMarket,
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
    var activeMarket = normalizeMarket(input.market);

    if (target <= 0) {
      return { status: "invalid", message: "目标成本必须大于 0。" };
    }

    if (result.remainingShares > 0 && result.afterSellCost <= target) {
      return {
        status: "none",
        message: "卖出后的成本已是 " + formatMoney(result.afterSellCost, activeMarket) + "，无需加仓即可达到目标。"
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
      var high = Math.max(1, activeMarket === "hk" ? input.lotSize : 1);
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
    var lotShares = activeMarket === "hk"
      ? Math.ceil(wholeShares / input.lotSize) * input.lotSize
      : wholeShares;
    var units = activeMarket === "hk" ? lotShares / input.lotSize : lotShares;
    var planBuyFee = getBuyFeeFor(input, lotShares, input.buyPrice);
    var outlay = lotShares * input.buyPrice + planBuyFee;
    var finalShares = result.remainingShares + lotShares;
    var actualCost = (result.basisAfterSale + outlay) / finalShares;
    var message = activeMarket === "hk"
      ? "理论需买入 " + formatNumber(theoreticalShares, 2, activeMarket)
        + " 股；按 " + formatNumber(input.lotSize, 0, activeMarket) + " 股一手，至少买入 "
        + formatNumber(units, 0, activeMarket) + " 手。"
      : "理论需买入 " + formatNumber(theoreticalShares, 2, activeMarket)
        + " 股；按整股交易，至少买入 " + formatNumber(lotShares, 0, activeMarket) + " 股。";

    return {
      status: "needed",
      theoreticalShares: theoreticalShares,
      lotShares: lotShares,
      lots: units,
      units: units,
      outlay: outlay,
      actualCost: actualCost,
      message: message
    };
  }

  function calculateLotPlans(input, result) {
    var activeMarket = normalizeMarket(input.market);
    return marketConfig(activeMarket).planQuantities.map(function (quantity) {
      var shares = activeMarket === "hk" ? quantity * input.lotSize : quantity;
      var planBuyFee = getBuyFeeFor(input, shares, input.buyPrice);
      var outlay = shares * input.buyPrice + planBuyFee;
      var finalShares = result.remainingShares + shares;
      return {
        lots: quantity,
        quantity: quantity,
        shares: shares,
        outlay: outlay,
        actualCost: (result.basisAfterSale + outlay) / finalShares
      };
    });
  }

  function setText(id, text) {
    element(id).textContent = text;
  }

  function applyMarketPresentation() {
    var config = marketConfig(currentMarket);
    var isUs = currentMarket === "us";
    document.body.dataset.market = currentMarket;
    document.documentElement.style.setProperty("--currency-symbol", '"' + config.symbol + '"');

    document.querySelectorAll("#marketSwitch button[data-market]").forEach(function (button) {
      var active = button.dataset.market === currentMarket;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    document.querySelectorAll("[data-currency-code]").forEach(function (node) {
      node.textContent = config.currency;
    });
    document.querySelectorAll("[data-fee-currency]").forEach(function (node) {
      node.textContent = config.currency + " / 笔";
    });
    document.querySelectorAll("[data-currency-per-share]").forEach(function (node) {
      node.textContent = config.currency + " / 股";
    });
    document.querySelectorAll("[data-range-min]").forEach(function (node) {
      node.textContent = config.symbol + "0";
    });
    document.querySelectorAll("[data-range-max]").forEach(function (node) {
      node.textContent = config.symbol + config.rangeMax;
    });
    document.querySelectorAll("[data-position-zero]").forEach(function (node) {
      node.textContent = config.symbol + "0";
    });

    var stockCodeInput = element("stockCode");
    stockCodeInput.placeholder = isUs ? "AAPL" : "00700";
    stockCodeInput.maxLength = isUs ? 10 : 5;
    stockCodeInput.inputMode = isUs ? "text" : "numeric";
    stockCodeInput.pattern = isUs ? "[A-Za-z0-9.-]*" : "[0-9]*";
    element("stockName").placeholder = isUs ? "Apple" : "腾讯控股";
    element("lotSizeField").hidden = isUs;
    element("lotSize").value = isUs ? 1 : element("lotSize").value;

    ["currentShares", "buyShares", "sellShares"].forEach(function (id) {
      element(id).step = String(config.quantityStep);
    });
    [sellRange, buyRange].forEach(function (range) {
      range.max = String(config.rangeMax);
    });

    setText("comparisonKicker", isUs ? "SHARE MATRIX" : "LOT MATRIX");
    setText("comparisonTitle", isUs ? "1 / 5 / 10 / 25 / 50 股方案" : "1 至 5 手买入方案");
    setText("comparisonMeta", isUs ? "整股 · 单笔计费" : "整手 · 单笔计费");
    setText("targetPlanQuantityLabel", isUs ? "整股数量" : "整手股数");
    setText("feeDialogTitle", config.name + "交易费用设置");
    setText("feeDialogNote", isUs
      ? "SEC 与 FINRA 费用仅在卖出侧估算；ADR、平台费及券商舍入方式可能不同，实际以成交单为准。规则核对日期：2026-07-28。"
      : "“印花税豁免”适用于符合条件的证券（如部分 ETF）；实际收费仍以券商成交单为准。费用规则核对日期：2026-07-28。");
    setFeeInputPresentation(feeSettings.mode === "auto");
  }

  function switchMarket(nextMarket) {
    var next = normalizeMarket(nextMarket);
    if (next === currentMarket) {
      return;
    }
    var previous = currentMarket;
    var previousDefaults = marketDefaults(previous, false);
    var isUntouchedExample = !textValue("stockCode") && !textValue("stockName")
      && Object.keys(DEFAULTS).every(function (key) {
        return Math.abs(numberValue(key) - Number(previousDefaults[key])) < 0.000001;
      });
    var previousLotSize = numberValue("lotSize");
    if (previous === "hk" && previousLotSize > 0) {
      lastHkLotSize = previousLotSize;
    }
    currentMarket = next;
    feeSettings = defaultFeeSettings(currentMarket);

    if (isUntouchedExample) {
      var nextDefaults = marketDefaults(currentMarket, false);
      Object.keys(DEFAULTS).forEach(function (key) {
        element(key).value = nextDefaults[key];
      });
      element("stockCode").value = "";
      element("stockName").value = "";
    } else {
      element("lotSize").value = currentMarket === "hk"
        ? lastHkLotSize
        : MARKET_CONFIGS.us.quantityStep;
      element("sellFee").value = feeSettings.manualSellFee;
      element("buyFee").value = feeSettings.manualBuyFee;
    }

    element("stockCode").value = normalizedStockCode(element("stockCode").value, currentMarket);
    applyMarketPresentation();
    syncRangeFromNumber(sellRange, sellPriceInput);
    syncRangeFromNumber(buyRange, buyPriceInput);
    update();
    showCopyToast("已切换至" + marketConfig(currentMarket).name, false);
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
    setText(
      "positionSummary",
      formatNumber(input.marketPrice, 2, input.market) + "/" + formatNumber(result.newDilutedCost, 2, input.market)
    );
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
    var isUs = normalizeMarket(input.market) === "us";
    latestTargetPlan = plan.status === "needed" ? plan : null;

    setText("targetPlanBadge", "目标 " + formatMoney(input.targetCost, input.market));
    setText("targetPlanMessage", plan.message);
    element("targetPlanBody").className = "target-plan-body target-plan-" + plan.status;

    if (plan.status === "needed") {
      setText("targetPlanShares", formatNumber(plan.lotShares, 0, input.market) + " 股");
      setText("targetPlanOutlay", formatMoney(plan.outlay, input.market));
      setText("targetPlanActualCost", formatMoney(plan.actualCost, input.market));
      applyTargetPlanButton.textContent = isUs
        ? "应用 " + formatNumber(plan.lotShares, 0, input.market) + " 股方案"
        : "应用 " + formatNumber(plan.lots, 0, input.market) + " 手方案";
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
    var isUs = normalizeMarket(input.market) === "us";
    comparisonBody.replaceChildren();

    plans.forEach(function (plan) {
      var row = document.createElement("tr");
      var isSelected = Math.abs(input.buyShares - plan.shares) < 1e-9;
      var planLabel = formatNumber(plan.quantity, 0, input.market) + (isUs ? " 股" : " 手");
      var planCell = createCell(planLabel);
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
      actionButton.setAttribute("aria-label", "选用 " + planLabel + "买入方案");
      actionCell.appendChild(actionButton);

      row.appendChild(planCell);
      row.appendChild(createCell(formatNumber(plan.shares, 0, input.market) + " 股"));
      row.appendChild(createCell(formatMoney(plan.outlay, input.market)));
      row.appendChild(createCell(formatMoney(plan.actualCost, input.market)));
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
    element("chartEvolutionLine").setAttribute("visibility", "hidden");
    element("chartBasisPoint").setAttribute("visibility", "hidden");
    element("chartPoint").setAttribute("visibility", "hidden");
    element("chartBasisCallout").setAttribute("visibility", "hidden");
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
    var padding = { left: 54, right: 18, top: 44, bottom: 34 };
    element("chartVerticalGuide").removeAttribute("visibility");
    element("chartHorizontalGuide").removeAttribute("visibility");
    element("chartEvolutionLine").removeAttribute("visibility");
    element("chartBasisPoint").removeAttribute("visibility");
    element("chartPoint").removeAttribute("visibility");
    element("chartBasisCallout").removeAttribute("visibility");
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
    costs.push(input.currentCost);
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
      }, marketConfig(input.market).symbol + tick.toFixed(0)));
    });

    var pointX = x(Math.max(xMin, Math.min(xMax, input.buyPrice)));
    var pointY = y(result.newDilutedCost);
    var basisPointY = y(input.currentCost);
    var verticalGuide = element("chartVerticalGuide");
    var horizontalGuide = element("chartHorizontalGuide");
    var evolutionLine = element("chartEvolutionLine");
    verticalGuide.setAttribute("x1", pointX);
    verticalGuide.setAttribute("x2", pointX);
    verticalGuide.setAttribute("y1", Math.min(pointY, basisPointY));
    verticalGuide.setAttribute("y2", padding.top + plotHeight);
    horizontalGuide.setAttribute("x1", padding.left);
    horizontalGuide.setAttribute("x2", pointX);
    horizontalGuide.setAttribute("y1", pointY);
    horizontalGuide.setAttribute("y2", pointY);
    evolutionLine.setAttribute("x1", pointX);
    evolutionLine.setAttribute("x2", pointX);
    evolutionLine.setAttribute("y1", basisPointY);
    evolutionLine.setAttribute("y2", pointY);
    element("chartBasisPoint").setAttribute("cx", pointX);
    element("chartBasisPoint").setAttribute("cy", basisPointY);
    element("chartPoint").setAttribute("cx", pointX);
    element("chartPoint").setAttribute("cy", pointY);

    var basisLabel = element("chartBasisLabel");
    var basisLabelBg = element("chartBasisLabelBg");
    var basisCallout = element("chartBasisCallout");
    var pointLabel = element("chartPointLabel");
    var pointLabelBg = element("chartPointLabelBg");
    var pointCallout = element("chartPointCallout");
    setText("chartBasisLabel", "原成本 " + input.currentCost.toFixed(2));
    setText("chartPointLabel", "新成本 " + result.newDilutedCost.toFixed(2));

    var calloutWidth = 122;
    var calloutHeight = 24;
    var calloutY = 7;
    var basisCalloutX = padding.left;
    var pointCalloutX = basisCalloutX + calloutWidth + 8;
    basisLabel.setAttribute("x", 10);
    basisLabel.setAttribute("y", 16);
    pointLabel.setAttribute("x", 10);
    pointLabel.setAttribute("y", 16);
    basisLabelBg.setAttribute("width", calloutWidth);
    basisLabelBg.setAttribute("height", calloutHeight);
    pointLabelBg.setAttribute("width", calloutWidth);
    pointLabelBg.setAttribute("height", calloutHeight);
    basisCallout.setAttribute("transform", "translate(" + basisCalloutX + "," + calloutY + ")");
    pointCallout.setAttribute("transform", "translate(" + pointCalloutX + "," + calloutY + ")");
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
    document.title = label ? label + " · 小算盘 · CostBuddy" : "小算盘 · CostBuddy";
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
    } else if (normalizeMarket(input.market) === "hk" && input.buyShares > 0
      && input.lotSize > 0 && input.buyShares % input.lotSize !== 0) {
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
    var defaults = marketDefaults(currentMarket, false);
    Object.keys(DEFAULTS).forEach(function (key) {
      element(key).value = defaults[key];
    });
    Object.keys(TEXT_DEFAULTS).forEach(function (key) {
      element(key).value = TEXT_DEFAULTS[key];
    });
    feeSettings = defaultFeeSettings(currentMarket);
    applyMarketPresentation();
    sellRange.value = defaults.sellPrice;
    buyRange.value = defaults.buyPrice;
    update();
    showCopyToast("已恢复" + marketConfig(currentMarket).name + "示例参数", false);
  }

  function setClearPlanMenuOpen(isOpen) {
    clearPlanMenu.hidden = !isOpen;
    clearPlanButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
    clearPlanButton.classList.toggle("is-open", isOpen);
  }

  function clearTradePlan(scope) {
    var shouldClearBuy = scope === "buy" || scope === "all";
    var shouldClearSell = scope === "sell" || scope === "all";

    if (shouldClearBuy) {
      buyPriceInput.value = 0;
      element("buyShares").value = 0;
      element("buyFee").value = 0;
      feeSettings.manualBuyFee = 0;
      syncRangeFromNumber(buyRange, buyPriceInput);
    }
    if (shouldClearSell) {
      sellPriceInput.value = 0;
      element("sellShares").value = 0;
      element("sellFee").value = 0;
      feeSettings.manualSellFee = 0;
      syncRangeFromNumber(sellRange, sellPriceInput);
    }

    setClearPlanMenuOpen(false);
    update();
    showCopyToast(scope === "buy"
      ? "已清除买入计划"
      : (scope === "sell" ? "已清除卖出计划" : "已清除全部买卖计划"), false);
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
    var isUs = currentMarket === "us";
    var securityType = isUs ? "us-stock" : syncSecurityTypePreset();
    return {
      mode: selectedMode ? selectedMode.value : "manual",
      securityType: securityType,
      commissionRate: Math.max(0, numberValue(isUs ? "usCommissionRate" : "commissionRate")),
      minimumCommission: Math.max(0, numberValue(isUs ? "usMinimumCommission" : "minimumCommission")),
      includeStampDuty: isUs ? false : element("includeStampDuty").checked,
      includeSettlementFee: isUs ? false : element("includeSettlementFee").checked,
      includeSecFee: isUs && element("includeSecFee").checked,
      includeFinraTaf: isUs && element("includeFinraTaf").checked,
      secRatePerMillion: feeSettings.secRatePerMillion,
      finraTafRate: feeSettings.finraTafRate,
      finraTafMax: feeSettings.finraTafMax,
      manualSellFee: feeSettings.manualSellFee,
      manualBuyFee: feeSettings.manualBuyFee
    };
  }

  function refreshFeeDialog() {
    var settings = dialogFeeSettings();
    var isAuto = settings.mode === "auto";
    var isUs = currentMarket === "us";
    element("autoFeeSettings").hidden = !isAuto;
    element("hkAutoFeeSettings").hidden = isUs;
    element("usAutoFeeSettings").hidden = !isUs;
    setText("feeModeSummary", isAuto
      ? securityTypeLabel(settings.securityType, false, currentMarket) + " · 按成交金额估算"
      : "当前使用手动费用");

    var buyPreview = calculateEstimatedFee(
      numberValue("buyShares"), numberValue("buyPrice"), settings, "buy", currentMarket
    );
    var sellPreview = calculateEstimatedFee(
      numberValue("sellShares"), numberValue("sellPrice"), settings, "sell", currentMarket
    );
    setText("autoBuyFeePreview", formatMoney(buyPreview.total, currentMarket));
    setText("autoSellFeePreview", formatMoney(sellPreview.total, currentMarket));
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
    element("usCommissionRate").value = feeSettings.commissionRate;
    element("usMinimumCommission").value = feeSettings.minimumCommission;
    element("includeSecFee").checked = feeSettings.includeSecFee;
    element("includeFinraTaf").checked = feeSettings.includeFinraTaf;
    if (currentMarket === "hk") {
      syncSecurityTypePreset();
    }
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
        ? "净收回 " + formatMoney(result.netCashFlow, input.market)
        : "净投入 " + formatMoney(Math.abs(result.netCashFlow), input.market));
    var lines = ["小算盘 · CostBuddy", "市场：" + marketConfig(input.market).name];
    if (stockLabel(input)) {
      lines.push("证券：" + stockLabel(input));
    }
    lines.push(
      "目前持仓：" + formatNumber(input.currentShares, 0, input.market) + " 股",
      "目前成本：" + formatMoney(input.currentCost, input.market) + " / 股",
      "买入：" + formatNumber(input.buyShares, 0, input.market) + " 股 × " + formatMoney(input.buyPrice, input.market),
      "卖出：" + formatNumber(input.sellShares, 0, input.market) + " 股 × " + formatMoney(input.sellPrice, input.market),
      "交易费用：" + formatMoney(result.totalFees, input.market) + "（" + (input.feeMode === "auto"
        ? "自动估算 · " + securityTypeLabel(input.feeSettings.securityType, false, input.market)
        : "手动填写") + "）",
      "交易后持仓：" + formatNumber(result.finalShares, 0, input.market) + " 股",
      "资金回本成本：" + formatMoney(result.newDilutedCost, input.market) + " / 股",
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


  function normalizedFeeSettings(source, market) {
    var activeMarket = normalizeMarket(market || (source && source.market) || currentMarket);
    var settings = defaultFeeSettings(activeMarket);
    if (!source || typeof source !== "object") {
      return settings;
    }
    settings.mode = source.mode === "auto" ? "auto" : "manual";
    if (activeMarket === "us") {
      settings.securityType = "us-stock";
    } else {
      settings.securityType = ["stock", "stamp-exempt", "custom"].indexOf(source.securityType) >= 0
        ? source.securityType
        : (source.includeStampDuty === false ? "stamp-exempt" : "stock");
    }
    [
      "commissionRate", "minimumCommission", "manualSellFee", "manualBuyFee",
      "secRatePerMillion", "finraTafRate", "finraTafMax"
    ].forEach(function (key) {
      if (source[key] !== null && source[key] !== "" && Number.isFinite(Number(source[key]))) {
        settings[key] = Math.max(0, Number(source[key]));
      }
    });
    ["includeStampDuty", "includeSettlementFee", "includeSecFee", "includeFinraTaf"].forEach(function (key) {
      if (typeof source[key] === "boolean") {
        settings[key] = source[key];
      }
    });
    if (activeMarket === "hk") {
      if (settings.securityType === "stock") {
        settings.includeStampDuty = true;
      } else if (settings.securityType === "stamp-exempt") {
        settings.includeStampDuty = false;
      }
      settings.includeSecFee = false;
      settings.includeFinraTaf = false;
    } else {
      settings.includeStampDuty = false;
      settings.includeSettlementFee = false;
    }
    return settings;
  }

  function captureFormValues() {
    var values = { market: currentMarket };
    Object.keys(DEFAULTS).forEach(function (key) {
      values[key] = key === "lotSize" && currentMarket === "us" ? 1 : numberValue(key);
    });
    values.stockCode = normalizedStockCode(textValue("stockCode"), currentMarket);
    values.stockName = textValue("stockName");
    return values;
  }

  function inputFromState(values, settingsSource) {
    var activeMarket = normalizeMarket(values && values.market);
    var settings = normalizedFeeSettings(settingsSource, activeMarket);
    var defaults = marketDefaults(activeMarket, false);
    var input = { market: activeMarket };
    Object.keys(DEFAULTS).forEach(function (key) {
      input[key] = Number.isFinite(Number(values && values[key])) ? Number(values[key]) : defaults[key];
    });
    if (activeMarket === "us") {
      input.lotSize = 1;
    }
    input.stockCode = normalizedStockCode(values && values.stockCode, activeMarket);
    input.stockName = String(values && values.stockName || "").trim();
    input.feeMode = settings.mode;
    input.feeSettings = Object.assign({}, settings);
    if (settings.mode === "auto") {
      input.sellFee = calculateEstimatedFee(
        input.sellShares, input.sellPrice, settings, "sell", activeMarket
      ).total;
      input.buyFee = calculateEstimatedFee(
        input.buyShares, input.buyPrice, settings, "buy", activeMarket
      ).total;
    }
    return input;
  }

  function setCalculatorState(values, settingsSource, shouldUpdate) {
    currentMarket = normalizeMarket(values && values.market);
    var defaults = marketDefaults(currentMarket, false);
    feeSettings = normalizedFeeSettings(settingsSource, currentMarket);
    applyMarketPresentation();
    Object.keys(DEFAULTS).forEach(function (key) {
      if (Number.isFinite(Number(values && values[key]))) {
        element(key).value = Number(values[key]);
      } else {
        element(key).value = defaults[key];
      }
    });
    if (currentMarket === "us") {
      element("lotSize").value = 1;
    } else {
      lastHkLotSize = Math.max(1, numberValue("lotSize"));
    }
    element("stockCode").value = normalizedStockCode(values && values.stockCode, currentMarket);
    element("stockName").value = String(values && values.stockName || "").trim();
    if (feeSettings.mode === "manual") {
      feeSettings.manualSellFee = Number.isFinite(Number(values && values.sellFee))
        ? Number(values.sellFee)
        : feeSettings.manualSellFee;
      feeSettings.manualBuyFee = Number.isFinite(Number(values && values.buyFee))
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
    url.searchParams.set("m", currentMarket);
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
    url.searchParams.set("s31", feeSettings.includeSecFee ? "1" : "0");
    url.searchParams.set("taf", feeSettings.includeFinraTaf ? "1" : "0");
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
      var sharedMarket = normalizeMarket(params.get("m"));
      var defaults = marketDefaults(sharedMarket, false);
      var values = { market: sharedMarket };
      var validFields = 0;
      Object.keys(SHARE_FIELDS).forEach(function (key) {
        var raw = params.get(SHARE_FIELDS[key]);
        if (raw !== null && Number.isFinite(Number(raw))) {
          values[key] = Number(raw);
          validFields += 1;
        } else {
          values[key] = defaults[key];
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
        includeSecFee: params.get("s31") !== "0",
        includeFinraTaf: params.get("taf") !== "0",
        manualSellFee: params.get("msf") !== null ? params.get("msf") : values.sellFee,
        manualBuyFee: params.get("mbf") !== null ? params.get("mbf") : values.buyFee
      }, sharedMarket);
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
    var activeMarket = normalizeMarket(source.market || source.values.market);
    var values = { market: activeMarket };
    var valid = true;
    Object.keys(DEFAULTS).forEach(function (key) {
      if (!Number.isFinite(Number(source.values[key]))) {
        valid = false;
      } else {
        values[key] = Number(source.values[key]);
      }
    });
    if (activeMarket === "us") {
      values.lotSize = 1;
    }
    values.stockCode = normalizedStockCode(source.values.stockCode, activeMarket);
    values.stockName = String(source.values.stockName || "").trim();
    return valid ? {
      market: activeMarket,
      values: values,
      feeSettings: normalizedFeeSettings(source.feeSettings, activeMarket),
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
    var activeMarket = normalizeMarket(source.market || source.values.market);
    var values = { market: activeMarket };
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
    if (activeMarket === "us") {
      values.lotSize = 1;
    }
    values.stockCode = normalizedStockCode(source.values.stockCode, activeMarket);
    values.stockName = String(source.values.stockName || "").trim();
    return {
      id: String(source.id),
      market: activeMarket,
      values: values,
      feeSettings: normalizedFeeSettings(source.feeSettings, activeMarket),
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
    var activeMarket = normalizeMarket(values && values.market);
    return JSON.stringify({
      values: values,
      feeSettings: normalizedFeeSettings(settings, activeMarket),
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


  function scenarioCashText(value, market) {
    if (Math.abs(value) < 0.005) {
      return "持平";
    }
    return value > 0
      ? "收回 " + formatMoney(value, market)
      : "投入 " + formatMoney(Math.abs(value), market);
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
      marketConfig(input.market).shortName + " · "
      + (stockLabel(input) ? stockLabel(input) + " · " : "")
      + "买 " + formatNumber(input.buyShares, 0, input.market) + " 股 @ " + formatMoney(input.buyPrice, input.market)
      + " · 卖 " + formatNumber(input.sellShares, 0, input.market) + " 股 @ " + formatMoney(input.sellPrice, input.market));
    setText("scenarioCost" + slot, formatMoney(result.newDilutedCost, input.market));
    setText("scenarioCash" + slot, scenarioCashText(result.netCashFlow, input.market));
    setText("scenarioShares" + slot, formatNumber(result.finalShares, 0, input.market) + " 股");
    setText("scenarioFees" + slot, formatMoney(result.totalFees, input.market));
    return calculation;
  }

  function renderScenarioDialog() {
    var calculationA = renderScenarioSlot("A");
    var calculationB = renderScenarioSlot("B");
    var comparison = element("scenarioComparison");
    comparison.hidden = !(calculationA && calculationB);
    if (calculationA && calculationB) {
      if (calculationA.input.market !== calculationB.input.market) {
        setText("scenarioComparisonText", "不同市场币种不同，不直接比较金额。");
      } else {
        var market = calculationA.input.market;
        var costDifference = calculationB.result.newDilutedCost - calculationA.result.newDilutedCost;
        var cashDifference = calculationB.result.netCashFlow - calculationA.result.netCashFlow;
        var costText = Math.abs(costDifference) < 0.005
          ? "回本成本持平"
          : "回本成本" + (costDifference < 0 ? "低 " : "高 ")
            + formatMoney(Math.abs(costDifference), market);
        setText("scenarioComparisonText", costText + "；净资金流差 " + formatSignedMoney(cashDifference, market));
      }
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
    var version = Number(source && source.version);
    if (!source || typeof source !== "object" || source.format !== BACKUP_FORMAT
        || (version !== 1 && version !== BACKUP_VERSION)
        || !source.data || typeof source.data !== "object") {
      throw new Error("unsupported-backup");
    }
    var currentSource = source.data.current;
    var currentValues = currentSource && currentSource.values
      ? Object.assign({}, currentSource.values)
      : null;
    if (currentValues && !currentValues.market) {
      currentValues.market = normalizeMarket(currentSource && currentSource.market);
    }
    var normalizedCurrent = normalizeHoldingRecord({
      id: "backup-current",
      market: currentValues && currentValues.market,
      values: currentValues,
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
    record.market = currentMarket;
    record.values = captureFormValues();
    record.feeSettings = normalizedFeeSettings(feeSettings, currentMarket);
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
      var recordMarket = normalizeMarket(record.market || record.values.market);
      card.className = "holding-card" + (isCurrent ? " is-current" : "");
      card.dataset.recordId = record.id;
      card.innerHTML = ""
        + '<div class="holding-card-header">'
        + '  <div class="holding-card-title"><em class="holding-market-badge" data-field="market"></em><strong data-field="code"></strong><span data-field="name"></span></div>'
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
      card.querySelector('[data-field="market"]').textContent = marketConfig(recordMarket).shortName;
      card.querySelector('[data-field="code"]').textContent = record.values.stockCode || "未填写代码";
      card.querySelector('[data-field="name"]').textContent = record.values.stockName || "未命名持仓";
      card.querySelector('[data-field="status"]').textContent = isCurrent
        ? (isCurrentDirty() ? "正在编辑 · 有修改" : "正在编辑")
        : "已保存";
      card.querySelector('[data-field="shares"]').textContent = formatNumber(record.values.currentShares, 0, recordMarket) + " 股";
      card.querySelector('[data-field="cost"]').textContent = formatMoney(record.values.currentCost, recordMarket);
      card.querySelector('[data-field="price"]').textContent = formatMoney(record.values.marketPrice, recordMarket);
      card.querySelector('[data-field="basis"]').textContent = calculation
        ? formatMoney(calculation.result.newDilutedCost, recordMarket)
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
    var nextFeeSettings = normalizedFeeSettings(feeSettings, currentMarket);
    nextFeeSettings.manualSellFee = 0;
    nextFeeSettings.manualBuyFee = 0;
    currentRecordId = null;
    savedRecordSignature = null;
    pendingDeleteId = null;
    scenarios = { A: null, B: null };
    persistHoldingRecords();
    setCalculatorState(marketDefaults(currentMarket, true), nextFeeSettings, true);
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
        applyMarketPresentation();
        return;
      }
      var savedMarket = normalizeMarket(saved.market);
      saved.market = savedMarket;
      var savedFeeSettings = saved._feeSettings || saved.feeSettings;
      if (!savedFeeSettings || typeof savedFeeSettings !== "object") {
        savedFeeSettings = defaultFeeSettings(savedMarket);
        savedFeeSettings.manualSellFee = Number.isFinite(Number(saved.sellFee))
          ? Number(saved.sellFee)
          : savedFeeSettings.manualSellFee;
        savedFeeSettings.manualBuyFee = Number.isFinite(Number(saved.buyFee))
          ? Number(saved.buyFee)
          : savedFeeSettings.manualBuyFee;
      }
      setCalculatorState(saved, savedFeeSettings, false);
    } catch (error) {
      currentMarket = "hk";
      feeSettings = defaultFeeSettings(currentMarket);
      applyMarketPresentation();
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
    var isUs = input.market === "us";

    setText("mobileResultPreview", result.error
      ? "参数未完成"
      : formatMoney(result.newDilutedCost, input.market) + " / 股");

    setText("sellLots", isUs
      ? formatNumber(input.sellShares, 0, input.market) + " 股"
      : (input.lotSize > 0 ? (input.sellShares / input.lotSize).toFixed(2) + " 手" : "— 手"));
    setText("buyLots", isUs
      ? formatNumber(input.buyShares, 0, input.market) + " 股"
      : (input.lotSize > 0 ? (input.buyShares / input.lotSize).toFixed(2) + " 手" : "— 手"));
    setText("sellPriceOutput", formatMoney(input.sellPrice, input.market));
    setText("buyPriceOutput", formatMoney(input.buyPrice, input.market));
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
    setText("calculationBadge", input.feeMode === "auto"
      ? marketConfig(input.market).name + "费用自动估算"
      : "已含双边费用");

    setText("newDilutedCost", result.newDilutedCost.toFixed(2));
    setText("finalShares", formatNumber(result.finalShares, 0, input.market) + " 股");
    setText("recoverableCost", formatMoney(result.recoverableCost, input.market));
    setText("totalPnl", formatSignedMoney(result.totalPnl, input.market));
    element("totalPnl").className = result.totalPnl >= 0 ? "positive" : "negative";
    setText("pnlIcon", result.totalPnl >= 0 ? "盈" : "损");
    element("pnlIcon").className = "metric-icon pnl-icon " + (result.totalPnl >= 0 ? "positive" : "negative");
    setText("breakEvenGap", result.breakEvenGap === null
      ? "—"
      : (result.breakEvenGap >= 0 ? "+" : "") + result.breakEvenGap.toFixed(2) + "%");
    setText("costChange", Math.abs(result.costDelta) < 0.005
      ? "与目前成本基本持平"
      : "较目前成本" + (result.costDelta < 0 ? "下降 " : "上升 ")
        + formatMoney(Math.abs(result.costDelta), input.market) + " / 股");
    element("costChange").className = "cost-change "
      + (Math.abs(result.costDelta) < 0.005 ? "cost-neutral" : (result.costDelta < 0 ? "cost-lower" : "cost-higher"));
    updateResultInsight(input, result);
    element("breakEvenGap").className = result.breakEvenGap !== null && result.breakEvenGap <= 0 ? "positive" : "negative";

    if (Math.abs(result.netCashFlow) < 0.005) {
      setText("netCashFlow", "现金流持平");
      element("netCashFlow").className = "";
    } else if (result.netCashFlow > 0) {
      setText("netCashFlow", "净收回 " + formatMoney(result.netCashFlow, input.market));
      element("netCashFlow").className = "positive";
    } else {
      setText("netCashFlow", "净投入 " + formatMoney(Math.abs(result.netCashFlow), input.market));
      element("netCashFlow").className = "negative";
    }

    setText("originalBasis", formatMoney(result.originalBasis, input.market));
    setText("netSaleProceeds", (result.netSaleProceeds >= 0 ? "−" : "+")
      + formatMoney(Math.abs(result.netSaleProceeds), input.market));
    setText("buyOutlay", "+" + formatMoney(result.buyOutlay, input.market));
    setText("totalFees", formatMoney(result.totalFees, input.market));
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
  themeToggleButton.addEventListener("click", function () {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
  });
  supportFeedbackButton.addEventListener("click", function () {
    openDialog(supportDialog);
  });
  copyFeedbackEmailButton.addEventListener("click", function () {
    copyText("imurio@163.com", "邮箱已复制");
  });
  copyWechatButton.addEventListener("click", function () {
    copyText("idemising", "微信号已复制");
  });
  resetButton.addEventListener("click", function () {
    if (!resetArmed) {
      armResetConfirmation();
      return;
    }
    cancelResetConfirmation();
    restoreExample();
  });
  clearPlanButton.addEventListener("click", function () {
    var willOpen = clearPlanMenu.hidden;
    setClearPlanMenuOpen(willOpen);
    if (willOpen) {
      var firstMenuItem = clearPlanMenu.querySelector("button[data-clear-plan]");
      window.requestAnimationFrame(function () {
        firstMenuItem.focus();
      });
    }
  });
  clearPlanMenu.addEventListener("click", function (event) {
    var actionButton = event.target.closest("button[data-clear-plan]");
    if (actionButton) {
      clearTradePlan(actionButton.dataset.clearPlan);
    }
  });
  mobilePageButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setMobilePage(button.dataset.mobilePageTarget, true);
    });
  });
  mobileResultsButton.addEventListener("click", function () {
    setMobilePage("results", true);
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
    if (currentMarket === "hk") {
      syncSecurityTypePreset();
    }
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

  element("marketSwitch").addEventListener("click", function (event) {
    var button = event.target.closest("button[data-market]");
    if (button) {
      switchMarket(button.dataset.market);
    }
  });

  element("stockCode").addEventListener("blur", function () {
    element("stockCode").value = normalizedStockCode(element("stockCode").value, currentMarket);
    update();
  });
  document.addEventListener("click", function (event) {
    if (!clearPlanMenu.hidden && !event.target.closest(".clear-plan-control")) {
      setClearPlanMenuOpen(false);
    }
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

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !clearPlanMenu.hidden) {
      setClearPlanMenuOpen(false);
      clearPlanButton.focus();
    }
  });

  document.querySelectorAll("[data-close-dialog]").forEach(function (button) {
    button.addEventListener("click", function () {
      closeDialog(button.closest("dialog"));
    });
  });
  [basisDialog, feeDialog, scenarioDialog, holdingBookDialog, supportDialog].forEach(function (dialog) {
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) {
        closeDialog(dialog);
      }
    });
  });

  window.addEventListener("resize", scheduleWorkspaceFit);
  applyTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light", false);
  fitWorkspaceToWindow();

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
  applyMarketPresentation();
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
