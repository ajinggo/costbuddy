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
    cn: {
      code: "cn", name: "A 股", shortName: "CN", currency: "CNY",
      symbol: "¥", locale: "zh-CN", quantityMode: "lot", quantityStep: 100,
      rangeMax: 100, planQuantities: [1, 2, 3, 4, 5],
      defaults: {currentShares: 1000, currentCost: 10, marketPrice: 8, lotSize: 100,
        sellShares: 100, sellPrice: 9, sellFee: 0, buyShares: 200, buyPrice: 8, buyFee: 0, targetCost: 9}
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
  var chartHelp = document.querySelector(".chart-help");
  var chartHelpTrigger = document.querySelector(".chart-help-trigger");
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
  var costTrail = null;
  var selectedTrailNode = null;
  var savedRecordSignature = null;
  var pendingUnsavedAction = null;
  var pendingDeleteId = null;
  var pendingImportBackup = null;
  var HOLDING_TRASH_KEY = "costbuddy-holding-trash-v1";
  var HOLDING_RECOVERY_KEY = "costbuddy-before-import-v1";
  var holdingStorageFailed = false;


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
    return value === "cn" ? "cn" : value === "us" ? "us" : "hk";
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
    if (normalizeMarket(market) === "cn") {
      return Object.assign({}, DEFAULT_FEE_SETTINGS, {mode: "manual", manualSellFee: 0, manualBuyFee: 0});
    }
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
    var field = element(id);
    var value = id === "currentCost" && field.dataset.costDisplay === field.value
      && field.dataset.exactCost !== undefined ? field.dataset.exactCost : field.value;
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatCurrentCostInput() {
    var field = element("currentCost");
    if (field.value === "" || document.activeElement === field) return;
    var exact = numberValue("currentCost");
    field.value = exact.toFixed(2);
    field.dataset.exactCost = String(exact);
    field.dataset.costDisplay = field.value;
  }

  function textValue(id) {
    return String(element(id).value || "").trim();
  }


  function normalizedStockCode(value, market) {
    var code = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
    if (normalizeMarket(market || currentMarket) === "us") {
      return code.replace(/[^A-Z0-9.-]/g, "").slice(0, 10);
    }
    if (normalizeMarket(market || currentMarket) === "cn") {
      var digits = code.replace(/\D/g, "").slice(0, 6);
      return digits ? digits.padStart(6, "0") : "";
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
    if (turnover <= 0 || activeMarket === "cn") {
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
    if (activeMarket !== "us" && input.lotSize <= 0) {
      return { error: "每手股数必须大于 0。" };
    }
    if (!Number.isInteger(input.currentShares) || !Number.isInteger(input.sellShares)
      || !Number.isInteger(input.buyShares)) {
      return { error: "买入、卖出和目前股数请填写整数。" };
    }
    if (activeMarket !== "us" && !Number.isInteger(input.lotSize)) {
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
      var high = Math.max(1, activeMarket !== "us" ? input.lotSize : 1);
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
    var lotShares = activeMarket !== "us"
      ? Math.ceil(wholeShares / input.lotSize) * input.lotSize
      : wholeShares;
    var units = activeMarket !== "us" ? lotShares / input.lotSize : lotShares;
    var planBuyFee = getBuyFeeFor(input, lotShares, input.buyPrice);
    var outlay = lotShares * input.buyPrice + planBuyFee;
    var finalShares = result.remainingShares + lotShares;
    var actualCost = (result.basisAfterSale + outlay) / finalShares;
    var message = activeMarket !== "us"
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
      var shares = activeMarket !== "us" ? quantity * input.lotSize : quantity;
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

  function animateFeedback(target, frames, options) {
    if (!target || typeof target.animate !== "function") return;
    target.getAnimations().forEach(function (animation) { animation.cancel(); });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    target.animate(frames, options);
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
    stockCodeInput.placeholder = isUs ? "AAPL" : currentMarket === "cn" ? "600519" : "00700";
    stockCodeInput.maxLength = isUs ? 10 : currentMarket === "cn" ? 6 : 5;
    stockCodeInput.inputMode = isUs ? "text" : "numeric";
    stockCodeInput.pattern = isUs ? "[A-Za-z0-9.-]*" : "[0-9]*";
    element("stockName").placeholder = isUs ? "Apple" : currentMarket === "cn" ? "贵州茅台" : "腾讯控股";
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
    document.querySelector('input[name="feeMode"][value="auto"]').disabled = currentMarket === "cn";
    element("cnMarketNote").hidden = false;
    setText("feeDialogNote", currentMarket === "cn"
      ? "A 股暂仅支持手动费用。请分别填写买入、卖出实际总费用，默认 0 表示未计费用。" : isUs
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
    costTrail = null;
    selectedTrailNode = null;
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
        : marketConfig(currentMarket).quantityStep;
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
  function updateStages(input, result) {
    var hasSell = input.sellShares > 0, hasBuy = input.buyShares > 0;
    var grid = document.querySelector(".basis-dialog .stage-grid");
    var sellCard = grid.querySelector(".stage-sell"), buyCard = grid.querySelector(".stage-buy");
    var connectors = grid.querySelectorAll(".stage-connector");
    sellCard.hidden = !hasSell;
    buyCard.hidden = !hasBuy;
    connectors[0].hidden = !hasSell;
    connectors[1].hidden = !hasBuy;
    grid.dataset.steps = String(1 + Number(hasSell) + Number(hasBuy));
    grid.querySelector(".stage-step").textContent = !hasSell && !hasBuy ? "当前持仓" : !hasSell ? "加仓前" : "交易前";
    buyCard.querySelector(".stage-step").textContent = hasSell ? "买入后" : "加仓后";
    setText("stageTitle", !hasSell && !hasBuy ? "当前持仓成本" : !hasSell ? "加仓成本演变" : "回本成本演变");
    var formula = document.querySelector(".basis-dialog .basis-formula");
    formula.textContent = hasSell
      ? (hasBuy ? "（原持仓总成本 − 卖出净所得 + 买入总支出）÷ 交易后股数" : "（原持仓总成本 − 卖出净所得）÷ 剩余股数")
      : hasBuy ? "（原持仓总成本 + 买入金额 + 买入手续费）÷ 加仓后总股数" : "当前成本 = 原持仓总成本 ÷ 当前持仓股数";
    var notes = document.querySelectorAll(".basis-explanation > ul > li");
    notes[0].textContent = hasSell ? "卖出净所得会冲减仍需收回的资金，因此会影响剩余持仓的回本成本。" : hasBuy ? "加仓成本按原持仓与本次买入加权计算，买入手续费计入成本；卖出股数为 0，不计卖出费用。" : "当前没有买入或卖出，直接沿用当前持仓成本，不计买卖费用。";
    notes[1].hidden = !hasSell;
    document.querySelector(".basis-explanation > .dialog-lead").textContent = !hasSell && hasBuy ? "本次仅测算加仓后的每股成本，包含本次买入手续费。" : !hasSell ? "未设置交易，以下为当前持仓成本。" : "本页用于估算剩余持仓要收回全部投入资金时，对应的每股价格。";
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
    setText("formulaText", isEmptyState ? "填写参数后生成计算过程。" : "请先修正输入内容。");
    setText("chartOriginalCost", "—");
    setText("chartNewCost", "—");
    element("chartGrid").replaceChildren();
    element("confirmCostTrail").disabled = true;
    element("undoCostTrail").disabled = !costTrail || costTrail.nodes.length < 2;
    setText("trailStatus", isEmptyState ? "填写持仓和买入计划后开始记录。" : "请先修正输入内容，已确认记录仍保留。");
    setText("trailDetail", "暂无可显示的测算结果");
    element("trailHistoryList").replaceChildren();
    element("chartAnnotations").replaceChildren();
    element("chartInspection").replaceChildren();
    element("chartInspection").setAttribute("visibility", "hidden");
    var emptyChart = element("costChart");
    emptyChart.onpointermove = emptyChart.onpointerdown = emptyChart.onpointerleave = emptyChart.onfocus = emptyChart.onblur = emptyChart.onkeydown = null;
    element("chartLine").setAttribute("d", "");
    element("chartArea").setAttribute("d", "");
    element("chartVerticalGuide").setAttribute("visibility", "hidden");
    element("chartHorizontalGuide").setAttribute("visibility", "hidden");
    element("chartEvolutionLine").setAttribute("visibility", "hidden");
    element("chartBasisPoint").setAttribute("visibility", "hidden");
    element("chartPoint").setAttribute("visibility", "hidden");
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

  function drawCostTrail(input, result) {
    var history = window.CostTrail.normalize(costTrail);
    var compatible = !history || window.CostTrail.matches(history, input);
    var nodes = history ? history.nodes.slice() : [{cost:input.currentCost, shares:input.currentShares, at:Date.now()}];
    var canConfirm = compatible && input.buyShares > 0 && input.sellShares === 0;
    var plotted = nodes.slice();
    if (canConfirm) plotted.push({cost:result.newDilutedCost, shares:result.finalShares, buyPrice:input.buyPrice, buyShares:input.buyShares, buyFee:result.appliedBuyFee, preview:true});
    element("confirmCostTrail").disabled = !canConfirm;
    element("undoCostTrail").disabled = !history || history.nodes.length < 2;
    element("restoreTrailBaseline").hidden = compatible;
    setText("trailCount", (nodes.length - 1) + " 次加仓");
    setText("trailStatus", !compatible ? "持仓基准已变化，恢复已确认持仓后继续累计。" : input.sellShares > 0 ? "卖出后可从新持仓基准开启一段记录。" : input.buyShares > 0 ? "虚线是本次预览，确认后保存为新的记忆点。" : "填写下一次买入计划，接着当前持仓继续计算。");
    element("sellTrailContinuation").hidden = !(input.sellShares > 0 && input.buyShares === 0 && !result.error);
    if (input.sellShares > 0 && input.buyShares === 0 && !result.error) {
      setText("sellTrailSummary", formatNumber(result.finalShares, 0, input.market) + " 股 · " + formatMoney(result.newDilutedCost, input.market) + " / 股");
    }
    var grid = element("chartGrid"), marks = element("chartAnnotations");
    grid.replaceChildren(); marks.replaceChildren(); element("chartInspection").replaceChildren();
    ["chartVerticalGuide","chartHorizontalGuide","chartEvolutionLine","chartBasisPoint","chartPoint"].forEach(function(id){element(id).setAttribute("visibility","hidden");});
    element("chartArea").setAttribute("d", "");
    var min = Math.min.apply(null, plotted.map(function(n){return n.cost;}));
    var max = Math.max.apply(null, plotted.map(function(n){return n.cost;}));
    var pad = Math.max((max-min)*.18, Math.abs(max)*.025, .1); min-=pad; max+=pad;
    var chartHeight = 460;
    element('costChart').setAttribute('viewBox','0 0 620 '+chartHeight);
    element('costChart').style.setProperty('aspect-ratio','620 / '+chartHeight);
    var left=64,right=588,top=28,bottom=chartHeight-42;
    function x(i){return plotted.length === 1 ? (left+right)/2 : left+i*(right-left)/(plotted.length-1);}
    function y(v){return bottom-(v-min)/(max-min)*(bottom-top);}
    for(var t=0;t<4;t++){var v=min+(max-min)*t/3;grid.appendChild(svgNode("line",{x1:left,x2:right,y1:y(v),y2:y(v),"class":"chart-grid-line"}));grid.appendChild(svgNode("text",{x:left-10,y:y(v)+4,"text-anchor":"end","class":"chart-axis-label"},compactNumber(v)));}
    grid.appendChild(svgNode("text",{x:left,y:13,"class":"chart-axis-title"},marketConfig(input.market).currency+" / 股"));
    element("chartLine").setAttribute("d",nodes.map(function(n,i){return (i?"L":"M")+x(i)+","+y(n.cost);}).join(" "));
    if(canConfirm){var i=plotted.length-1;marks.appendChild(svgNode("path",{d:"M"+x(i-1)+","+y(plotted[i-1].cost)+" L"+x(i)+","+y(plotted[i].cost),"class":"trail-preview-line"}));}
    var selected = selectedTrailNode === null ? plotted.length-1 : Math.min(selectedTrailNode,plotted.length-1);
    function detail(index){
      selectedTrailNode=index; var n=plotted[index]; var title=n.preview?"本次待确认":index===0?"初始持仓":"第 "+index+" 次加仓";
      var box=element("trailDetail");box.replaceChildren();
      var heading=document.createElement("strong");heading.textContent=title+" · "+formatMoney(Number(n.cost.toFixed(2)),input.market)+" / 股";box.appendChild(heading);
      element("trailHistoryList").querySelectorAll("[data-history-node]").forEach(function(row){var active=Number(row.dataset.historyNode)===index;row.classList.toggle("is-selected",active);row.setAttribute("aria-pressed",String(active));});
      marks.querySelectorAll("[data-trail-node]").forEach(function(node){node.classList.toggle("is-selected",Number(node.dataset.trailNode)===index);node.setAttribute("aria-pressed",String(Number(node.dataset.trailNode)===index));});
    }
    plotted.forEach(function(n,i){
      var group=svgNode("g",{tabindex:0,role:"button","aria-label":(n.preview?"待确认":i===0?"初始持仓":"第"+i+"次加仓")+"，成本"+n.cost.toFixed(2),"data-trail-node":i,"class":"trail-node"+(n.preview?" is-preview":"")});
      group.appendChild(svgNode("circle",{cx:x(i),cy:y(n.cost),r:17,"class":"trail-hit"}));
      group.appendChild(svgNode("circle",{cx:x(i),cy:y(n.cost),r:6,"class":"trail-dot"}));
      group.onclick=function(){detail(i);};group.onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();detail(i);}};marks.appendChild(group);
      if(plotted.length<=9||i===0||i===plotted.length-1){grid.appendChild(svgNode("text",{x:x(i),y:chartHeight-19,"text-anchor":"middle","class":"chart-axis-label"},n.preview?"待确认":i===0?"初始":"第 "+i+" 次"));}
    });
    var historyList=element("trailHistoryList"), previousScroll=historyList.scrollTop;
    historyList.replaceChildren();
    if(nodes.length < 2) {
      var empty=document.createElement("p"); empty.className="trail-history-empty"; empty.textContent="确认本次加仓后，记录会显示在这里。"; historyList.appendChild(empty);
    }
    nodes.slice(1).map(function(n,i){return {node:n,index:i+1};}).reverse().forEach(function(entry){
      var n=entry.node, row=document.createElement("button"); row.type="button";row.className="trail-history-row";row.dataset.historyNode=entry.index;
      var title=document.createElement("strong");title.textContent="第 "+entry.index+" 次加仓";
      var cost=document.createElement("strong");cost.className="trail-history-cost";cost.textContent="成本 "+formatMoney(n.cost,input.market)+" / 股";
      var trade=document.createElement("span");trade.textContent="买入 "+formatNumber(n.buyShares,0,input.market)+" 股 × "+formatMoney(n.buyPrice,input.market);
      var fee=document.createElement("span");fee.className="trail-history-fee";fee.textContent="费用 "+formatMoney(n.buyFee,input.market);
      var total=document.createElement("span");total.className="trail-history-total";total.textContent="加仓后持有 "+formatNumber(n.shares,0,input.market)+" 股";
      var delta=document.createElement("span");delta.className="trail-history-delta";delta.textContent="较上次 "+formatSignedMoney(n.cost-nodes[entry.index-1].cost,input.market)+" / 股";
      var meta=document.createElement("span");meta.className="trail-history-meta";meta.append(trade,fee,total);
      row.append(title,cost,meta,delta);row.onclick=function(){detail(entry.index);};historyList.appendChild(row);
    });
    historyList.scrollTop=previousScroll;
    detail(selected);
    setText("chartDescription","加仓成本轨迹，已确认"+(nodes.length-1)+"次加仓。点选节点查看股数、价格和费用。虚线为待确认方案。");
    var previewLine = marks.querySelector(".trail-preview-line");
    if (previewLine) animateFeedback(previewLine, [{opacity:0.2},{opacity:0.58}], {duration:150,easing:"ease-out"});
  }

  function persistTrailHolding() {
    var record=findHoldingRecord(currentRecordId);
    if(record){record.values=captureFormValues();record.feeSettings=normalizedFeeSettings(feeSettings,currentMarket);record.costTrail=window.CostTrail.normalize(costTrail);record.updatedAt=Date.now();savedRecordSignature=holdingStateSignature(record.values,record.feeSettings,record.scenarios);persistHoldingRecords();}
  }
  function confirmCostTrail() {
    update();
    if(!latestInput||!latestResult||element("confirmCostTrail").disabled)return;
    var values=Object.assign({},captureFormValues(),{buyFee:latestResult.appliedBuyFee});
    var history=window.CostTrail.commit(costTrail,values);
    history.nodes[history.nodes.length-1].beforeSettings=Object.assign({},feeSettings);
    var last=history.nodes[history.nodes.length-1];
    var next=Object.assign({},values,{currentShares:last.shares,currentCost:last.cost,buyShares:0,sellShares:0,buyFee:0,sellFee:0,_costTrail:history});
    selectedTrailNode=null;setCalculatorState(next,feeSettings,true);persistTrailHolding();updateSavedStateUI();
    var confirmedNode=element("chartAnnotations").querySelector(".trail-node:last-child");
    if(confirmedNode){confirmedNode.classList.add("is-new");window.setTimeout(function(){confirmedNode.classList.remove("is-new");},520);}
    showCopyToast("已记录本次加仓，填写下一次买入计划即可继续",false);
  }
  function undoCostTrail() {
    if(!costTrail||costTrail.nodes.length<2)return;
    var history=window.CostTrail.normalize(costTrail), last=history.nodes.pop();
    setCalculatorState(Object.assign({},last.beforeValues,{_costTrail:history}),last.beforeSettings||feeSettings,true);persistTrailHolding();updateSavedStateUI();
    showCopyToast("已撤销上次加仓，并恢复该次买入参数",false);
  }

  function continueAfterSale() {
    update();
    if (!latestInput || !latestResult || latestInput.sellShares <= 0 || latestResult.remainingShares <= 0) return;
    var oldHistory = window.CostTrail.normalize(costTrail);
    var archived = oldHistory ? (oldHistory.archivedSegments || []).concat([{
      closedAt: Date.now(),
      reason: "sale",
      nodes: oldHistory.nodes
    }]) : [];
    var values = Object.assign({}, captureFormValues(), {
      currentShares: latestResult.finalShares,
      currentCost: latestResult.newDilutedCost,
      buyShares: 0,
      sellShares: 0,
      buyFee: 0,
      sellFee: 0
    });
    var nextHistory = {market: currentMarket, stockCode: values.stockCode, stockName: values.stockName,
      nodes: [{cost: values.currentCost, shares: values.currentShares, at: Date.now()}], archivedSegments: archived};
    selectedTrailNode = null;
    setCalculatorState(Object.assign({}, values, {_costTrail: nextHistory}), feeSettings, true);
    persistTrailHolding();
    updateSavedStateUI();
    showCopyToast("已按卖出结果建立新基准，旧轨迹已保留", false);
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
    } else if (normalizeMarket(input.market) !== "us" && input.buyShares > 0
      && input.lotSize > 0 && input.buyShares % input.lotSize !== 0) {
      message = "当前买入股数不是整手，实际成交请确认碎股规则。";
    } else if (input.buyShares > 0 && input.buyPrice > input.currentCost && input.sellShares === 0) {
      message = '买入价高于目前成本，本次加仓会抬高持仓成本。';
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
    costTrail = null;
    selectedTrailNode = null;
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
      mode: currentMarket === "cn" ? "manual" : selectedMode ? selectedMode.value : "manual",
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
    element("manualFeeSettings").hidden = isAuto;
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
    element("manualBuyFeeInput").value = feeSettings.manualBuyFee;
    element("manualSellFeeInput").value = feeSettings.manualSellFee;
    element("manualFeeError").hidden = true;
    document.querySelectorAll(".manual-fee-currency").forEach(function (unit) {
      unit.textContent = currentMarket === "us" ? "USD" : currentMarket === "cn" ? "CNY" : "HKD";
    });
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
    if (nextSettings.mode === "manual") {
      var buyField = element("manualBuyFeeInput");
      var sellField = element("manualSellFeeInput");
      var buyFee = Number(buyField.value);
      var sellFee = Number(sellField.value);
      if (buyField.value.trim() === "" || sellField.value.trim() === "" || !Number.isFinite(buyFee) || !Number.isFinite(sellFee) || buyFee < 0 || sellFee < 0) {
        element("manualFeeError").hidden = false;
        return;
      }
      nextSettings.manualBuyFee = buyFee;
      nextSettings.manualSellFee = sellFee;
    }
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
    settings.mode = activeMarket !== "cn" && source.mode === "auto" ? "auto" : "manual";
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
    costTrail = window.CostTrail.normalize(values && values._costTrail);
    selectedTrailNode = null;
    currentMarket = normalizeMarket(values && values.market);
    var defaults = marketDefaults(currentMarket, false);
    feeSettings = normalizedFeeSettings(settingsSource, currentMarket);
    applyMarketPresentation();
    delete element("currentCost").dataset.exactCost;
    delete element("currentCost").dataset.costDisplay;
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
      if (currentMarket === "hk") lastHkLotSize = Math.max(1, numberValue("lotSize"));
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
    window.CostBuddyShare.open(JSON.parse(JSON.stringify(latestInput)), JSON.parse(JSON.stringify(latestResult)));
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
      costTrail: window.CostTrail.normalize(source.costTrail),
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
      holdingStorageFailed = false;
    } catch (error) {
      holdingStorageFailed = true;
    }
    element("holdingStorageError").hidden = !holdingStorageFailed;
    updateHoldingCount();
    return !holdingStorageFailed;
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
    if (holdingStorageFailed) {
      saveHoldingButton.classList.remove("is-saved");
      saveHoldingButton.classList.add("is-dirty");
      setText("saveHoldingLabel", "保存失败 · 请备份");
      return;
    }
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
          costTrail: window.CostTrail.normalize(costTrail),
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
      costTrail: currentSource && currentSource.costTrail,
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
        costTrail: normalizedCurrent.costTrail,
        recordId: linkedRecordId
      }
    };
  }
  function previewBackupImport(backup) {
    pendingImportBackup = backup;
    var timeText = backup.exportedAt ? formatHoldingTime(backup.exportedAt) + " 导出" : "未记录导出时间";
    setText("importBackupSummary", "将载入 " + backup.holdings.length + " 条持仓，替换当前 " + holdingRecords.length + " 条 · " + timeText);
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
    try {
      localStorage.setItem(HOLDING_RECOVERY_KEY, JSON.stringify(backupPayload()));
    } catch (error) {
      showCopyToast("无法保存恢复副本，已停止导入，请先导出备份", true);
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
    setCalculatorState(Object.assign({}, backup.current.values, {_costTrail:backup.current.costTrail}), backup.current.feeSettings, true);
    updateScenarioCount();
    updateSavedStateUI();
    renderHoldingBook();
    closeDialog(importBackupDialog);
    showCopyToast(holdingStorageFailed ? "导入数据尚未保存，请立即导出备份" : "已导入 " + holdingRecords.length + " 条持仓，可恢复导入前的数据", holdingStorageFailed);
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
    record.costTrail = window.CostTrail.normalize(costTrail);
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
    showCopyToast(holdingStorageFailed ? "保存失败，请立即导出备份" : "已保存到持仓簿", holdingStorageFailed);
    return !holdingStorageFailed;
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

  function appendHoldingDetails(card, record) {
    var values = record.values, market = record.market;
    var money = function (value) { return formatMoney(value, market); };
    var history = record.costTrail;
    var note = document.createElement("p");
    note.className = "holding-plan-note";
    note.textContent = (values.buyShares || values.sellShares ? "测算中 · 买卖计划尚未确认" : "暂无待确认交易") + " · " + (history ? history.nodes.length - 1 : 0) + " 次已确认加仓";
    card.appendChild(note);
    var details = document.createElement("details");
    details.className = "holding-details";
    var summary = document.createElement("summary");
    summary.textContent = "查看完整数据与加仓记录";
    details.appendChild(summary);
    var list = document.createElement("dl");
    function row(label, value) {
      var term = document.createElement("dt"), description = document.createElement("dd");
      term.textContent = label; description.textContent = value;
      list.append(term, description);
    }
    row("每手股数", values.lotSize + " 股");
    row("买入计划（未确认）", values.buyShares + " 股 × " + money(values.buyPrice));
    row("卖出计划（测算）", values.sellShares + " 股 × " + money(values.sellPrice));
    var input = inputFromState(values, record.feeSettings);
    row("买入 / 卖出费用", money(input.buyFee) + " / " + money(input.sellFee));
    row("目标成本", money(values.targetCost));
    var settings = record.feeSettings;
    row("费用方式", settings.mode === "auto" ? "自动估算" : "手动填写");
    if (settings.mode === "auto") {
      row("佣金比例 / 最低佣金", settings.commissionRate + "% / " + money(settings.minimumCommission));
      row("费用项目", market === "us" ? "SEC：" + (settings.includeSecFee ? "计入" : "不计") + "；FINRA：" + (settings.includeFinraTaf ? "计入" : "不计") : "印花税：" + (settings.includeStampDuty ? "计入" : "不计") + "；结算费：" + (settings.includeSettlementFee ? "计入" : "不计"));
    }
    ["A", "B"].forEach(function (slot) {
      var snapshot = record.scenarios[slot], calculation = scenarioCalculation(snapshot);
      row("对比方案 " + slot, !snapshot ? "未保存" : !calculation ? "参数待完善" : formatMoney(calculation.result.newDilutedCost, calculation.input.market) + " / 股 · 买 " + calculation.input.buyShares + " 股 · 卖 " + calculation.input.sellShares + " 股");
    });
    details.appendChild(list);
    var title = document.createElement("h4"); title.textContent = "已确认加仓记录"; details.appendChild(title);
    var timeline = document.createElement("ol"); timeline.className = "holding-timeline";
    if (history) history.nodes.forEach(function (node, index) {
      var item = document.createElement("li"), strong = document.createElement("strong"), small = document.createElement("span");
      strong.textContent = (index ? "第 " + index + " 次加仓" : "初始持仓") + " · " + node.shares + " 股 · 成本 " + money(node.cost);
      small.textContent = formatHoldingTime(node.at) + (index ? " · 买入 " + node.buyShares + " 股 × " + money(node.buyPrice) + " · 费用 " + money(node.buyFee) + " · 成本变化 " + money(history.nodes[index - 1].cost) + " → " + money(node.cost) : " · 建立记录");
      item.append(strong, small); timeline.appendChild(item);
    });
    if (!history) { var empty = document.createElement("li"); empty.textContent = "尚无已确认记录，确认本次加仓后会保留节点。"; timeline.appendChild(empty); }
    details.appendChild(timeline);
    var tools = document.createElement("div"); tools.className = "holding-detail-actions";
    var label = document.createElement("label"); label.textContent = "股票名称";
    var name = document.createElement("input"); name.value = values.stockName; name.maxLength = 80; name.dataset.holdingName = "true"; name.placeholder = "填写名称"; label.appendChild(name); tools.appendChild(label);
    [["rename","保存名称"],["duplicate","复制测算"]].forEach(function (action) { var button = document.createElement("button"); button.type = "button"; button.dataset.holdingAction = action[0]; button.textContent = action[1]; tools.appendChild(button); });
    details.appendChild(tools); card.appendChild(details);
  }


  function renderHoldingBook() {
    holdingList.replaceChildren();
    holdingEmpty.hidden = holdingRecords.length > 0;
    var query = element("holdingSearch").value.trim().toLowerCase();
    var market = element("holdingMarketFilter").value;
    var visible = holdingRecords.filter(function (r) {
      return (market === "all" || r.market === market) && (r.values.stockCode + " " + r.values.stockName).toLowerCase().includes(query);
    }).sort(function (a, b) {
      return element("holdingSort").value === "code" ? a.values.stockCode.localeCompare(b.values.stockCode) : b.updatedAt - a.updatedAt;
    });
    element("holdingNoMatch").hidden = !holdingRecords.length || visible.length > 0;
    visible.forEach(function (record) {
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
        + '  <div><span>方案回本成本</span><strong data-field="basis"></strong></div>'
        + '</div>'
        + '<div class="holding-card-footer">'
        + '  <time data-field="time"></time>'
        + '  <div class="holding-card-actions">'
        + '    <button type="button" data-holding-action="load">继续测算</button>'
        + '    <button class="holding-delete-button" type="button" data-holding-action="delete">删除</button>'
        + '  </div>'
        + '</div>';
      appendHoldingDetails(card, record);
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
    setText("holdingBookFooter", visible.length + " / " + holdingRecords.length + " 条持仓 · 本机保存");
    try {
      element("undoHoldingDelete").hidden = !localStorage.getItem(HOLDING_TRASH_KEY);
      element("restoreHoldingBackup").hidden = !localStorage.getItem(HOLDING_RECOVERY_KEY);
    } catch (error) { /* Storage error is displayed by the save path. */ }
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
    setCalculatorState(Object.assign({}, record.values, {_costTrail:record.costTrail}), record.feeSettings, true);
    updateScenarioCount();
    updateSavedStateUI();
    closeDialog(holdingBookDialog);
    showCopyToast("已载入 " + (stockLabel(record.values) || "该持仓"), false);
  }

  function deleteHoldingRecord(recordId) {
    var deleted = findHoldingRecord(recordId);
    if (!deleted) return;
    try {
      localStorage.setItem(HOLDING_TRASH_KEY, JSON.stringify(deleted));
    } catch (error) { showCopyToast("无法创建撤销副本，已停止删除", true); return; }
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
    setMobilePage("ticket", true);
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
    element("unsavedSaveError").hidden = true;
    element("unsavedSaveError").textContent = "";
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
        _feeSettings: Object.assign({}, feeSettings),
        _costTrail: window.CostTrail.normalize(costTrail)
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      // Keep the entire active holding in sync, not just the global last-open form.
      var record = findHoldingRecord(currentRecordId);
      if (record) {
        var values = captureFormValues();
        var settings = normalizedFeeSettings(feeSettings, currentMarket);
        var scenarioState = normalizedScenarios(scenarios);
        var history = window.CostTrail.normalize(costTrail);
        var signature = holdingStateSignature(values, settings, scenarioState);
        if (holdingStorageFailed || signature !== savedRecordSignature || JSON.stringify(history) !== JSON.stringify(record.costTrail)) {
          record.market = currentMarket;
          record.values = values;
          record.feeSettings = settings;
          record.scenarios = scenarioState;
          record.costTrail = history;
          record.updatedAt = Date.now();
          savedRecordSignature = signature;
          persistHoldingRecords();
        }
      }
    } catch (error) {
      holdingStorageFailed = true;
      element("holdingStorageError").hidden = false;
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


  element('resultShareButton').addEventListener('click',shareCurrentPlan);

  function update() {
    formatCurrentCostInput();
    var input = getInputs();
    var result = calculateCosts(input);
    var isUs = input.market === "us";
    element('resultShareButton').disabled = !!result.error;

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

    var costOutput=element("newDilutedCost");
    var nextCostText=result.newDilutedCost.toFixed(2);
    var costChanged=costOutput.textContent!==nextCostText;
    setText("newDilutedCost", nextCostText);
    if(costChanged)animateFeedback(costOutput,[{opacity:.55,transform:"translateY(3px)"},{opacity:1,transform:"translateY(0)"}],{duration:170,easing:"ease-out"});
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
    setText("chartOriginalCost", formatMoney(input.currentCost, input.market));
    setText("chartNewCost", formatMoney(result.newDilutedCost, input.market));

    updateStages(input, result);
    renderTargetPlan(input, result);
    renderPlanComparison(input, result);
    drawCostTrail(input, result);
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
  element("confirmCostTrail").addEventListener("click",confirmCostTrail);
  element("continueAfterSale").addEventListener("click",continueAfterSale);
  element("undoCostTrail").addEventListener("click",undoCostTrail);
  element("restoreTrailBaseline").addEventListener("click",function(){
    if(!costTrail)return;var last=costTrail.nodes[costTrail.nodes.length-1];
    setCalculatorState(Object.assign({},captureFormValues(),{market:costTrail.market,stockCode:costTrail.stockCode,stockName:costTrail.stockName,currentShares:last.shares,currentCost:last.cost,_costTrail:costTrail}),feeSettings,true);
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
  element("currentCost").addEventListener("input", function () {
    delete this.dataset.exactCost;
    delete this.dataset.costDisplay;
  });
  element("currentCost").addEventListener("blur", formatCurrentCostInput);
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
  ["holdingSearch", "holdingMarketFilter", "holdingSort"].forEach(function (id) {
    element(id).addEventListener(id === "holdingSearch" ? "input" : "change", renderHoldingBook);
  });
  element("undoHoldingDelete").addEventListener("click", function () {
    try {
      var record = normalizeHoldingRecord(JSON.parse(localStorage.getItem(HOLDING_TRASH_KEY)));
      if (!record) throw new Error("invalid-trash");
      if (!findHoldingRecord(record.id)) holdingRecords.push(record);
      if (!persistHoldingRecords()) { updateSavedStateUI(); return; }
      localStorage.removeItem(HOLDING_TRASH_KEY);
      renderHoldingBook();
      showCopyToast("已恢复最近删除的持仓", false);
    } catch (error) { showCopyToast("无法恢复删除的持仓，请检查浏览器存储", true); }
  });
  element("restoreHoldingBackup").addEventListener("click", function () {
    try {
      previewBackupImport(normalizeBackupPayload(JSON.parse(localStorage.getItem(HOLDING_RECOVERY_KEY))));
    } catch (error) { showCopyToast("恢复副本无法读取，请选择导出的备份文件", true); }
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
    } else if (actionButton.dataset.holdingAction === "rename") {
      var record = findHoldingRecord(recordId);
      var name = card.querySelector("[data-holding-name]").value.trim().slice(0, 80);
      record.values.stockName = name;
      if (record.costTrail) record.costTrail.stockName = name;
      record.updatedAt = Date.now();
      if (recordId === currentRecordId) {
        element("stockName").value = name;
        if (costTrail) costTrail.stockName = name;
        update();
      }
      persistHoldingRecords(); updateSavedStateUI(); renderHoldingBook();
      showCopyToast(holdingStorageFailed ? "名称尚未保存，请导出备份" : "名称已更新", holdingStorageFailed);
    } else if (actionButton.dataset.holdingAction === "duplicate") {
      var copy = normalizeHoldingRecord(JSON.parse(JSON.stringify(findHoldingRecord(recordId))));
      copy.id = createHoldingId(); copy.updatedAt = Date.now();
      copy.values.stockName = (copy.values.stockName || copy.values.stockCode) + " · 副本";
      if (copy.costTrail) copy.costTrail.stockName = copy.values.stockName;
      holdingRecords.push(copy);
      persistHoldingRecords(); renderHoldingBook(); updateSavedStateUI();
      showCopyToast(holdingStorageFailed ? "副本尚未保存，请导出备份" : "已复制完整测算，可在持仓簿选择", holdingStorageFailed);
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
    } else if (action === "save") {
      update();
      var reason = !latestInput || !latestResult
        ? "当前参数尚未完成，暂时无法保存。可以取消后补全参数，或选择不保存直接新建。"
        : (!latestInput.stockCode && !latestInput.stockName
          ? "保存需要填写股票代码或名称。可以取消后填写，或选择不保存直接新建。"
          : "");
      if (reason) {
        setText("unsavedSaveError", reason);
        element("unsavedSaveError").hidden = false;
      } else if (saveCurrentHolding()) {
        closeDialog(unsavedDialog);
        performPendingUnsavedAction();
      }
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
    if (chartHelp && !chartHelp.contains(event.target)) {
      chartHelp.classList.remove("is-open");
      chartHelpTrigger.setAttribute("aria-expanded", "false");
    }
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
  chartHelpTrigger.addEventListener("click", function () {
    var isOpen = chartHelp.classList.toggle("is-open");
    chartHelpTrigger.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && chartHelp && chartHelp.classList.contains("is-open")) {
      chartHelp.classList.remove("is-open");
      chartHelpTrigger.setAttribute("aria-expanded", "false");
      chartHelpTrigger.blur();
    }
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
