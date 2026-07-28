import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const artifactDir = join(root, "test-artifacts", "responsive");
const compactOnly = process.argv.includes("--compact");
const viewports = compactOnly
  ? [
      { name: "1093x700", width: 1093, height: 700 },
      { name: "1200x800", width: 1200, height: 800 },
      { name: "1280x600", width: 1280, height: 600 },
      { name: "1280x720", width: 1280, height: 720 }
    ]
  : [
      { name: "900x768", width: 900, height: 768 },
      { name: "1024x768", width: 1024, height: 768 },
      { name: "1093x700", width: 1093, height: 700 },
      { name: "1200x800", width: 1200, height: 800 },
      { name: "1280x600", width: 1280, height: 600 },
      { name: "1280x720", width: 1280, height: 720 },
      { name: "1366x768", width: 1366, height: 768 },
      { name: "1440x900", width: 1440, height: 900 },
      { name: "1600x900", width: 1600, height: 900 },
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
      { name: "3840x2160", width: 3840, height: 2160 }
    ];
const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
      const pathname = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
      const filePath = resolve(root, `.${pathname}`);
      if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) throw new Error("Not a file");
      response.writeHead(200, { "Content-Type": mime[extname(filePath)] || "application/octet-stream" });
      response.end(await readFile(filePath));
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  return new Promise((accept) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      accept({ server, url: `http://127.0.0.1:${address.port}/` });
    });
  });
}

async function readLayout(page) {
  return page.evaluate(() => {
    const measure = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        bottom: rect.bottom,
        clientHeight: element.clientHeight,
        clientWidth: element.clientWidth,
        display: style.display,
        height: rect.height,
        left: rect.left,
        overflowY: style.overflowY,
        right: rect.right,
        scrollHeight: element.scrollHeight,
        scrollWidth: element.scrollWidth,
        top: rect.top,
        visibility: style.visibility,
        width: rect.width
      };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      html: measure("html"),
      body: measure("body"),
      dashboard: measure(".dashboard"),
      sidebar: measure(".sidebar-column"),
      header: measure(".app-header"),
      headerActions: measure(".header-actions"),
      ticketHeader: measure(".controls-header"),
      ticketTitle: measure(".controls-header > div:first-child"),
      ticketTools: measure(".controls-header-tools"),
      saveLabel: measure("#saveHoldingLabel"),
      clearLabel: measure("#clearPlanButton > span"),
      mobileSwitcher: measure(".mobile-page-switcher"),
      results: measure(".results"),
      resultMain: measure(".result-main-column"),
      resultSide: measure(".result-side-column"),
      resultHero: measure(".result-hero"),
      stagePanel: measure(".stage-section"),
      chartPanel: measure(".chart-section"),
      comparisonPanel: measure(".comparison-section"),
      comparisonTable: measure(".comparison-table"),
      sideModuleOrder: Array.from(document.querySelectorAll(".result-side-column > section"))
        .map((element) => Array.from(element.classList).find((name) => [
          "price-position",
          "target-plan",
          "comparison-section",
          "breakdown"
        ].includes(name))),
      numericStyles: [
        "#newDilutedCost",
        "#netCashFlow",
        "#recoverableCost",
        "#totalPnl",
        "#positionSummary",
        ".comparison-table tbody td:nth-child(2)"
      ].map((selector) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).fontVariantNumeric : null;
      }),
      inputTextFits: ["#currentShares", "#currentCost", "#lotSize"].map((selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const style = getComputedStyle(element);
        const context = document.createElement("canvas").getContext("2d");
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        return {
          available: element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
          required: context.measureText(element.value).width
        };
      }),
      criticalTextFits: [
        document.querySelector("#positionSummary"),
        document.querySelector("#targetPlanBadge"),
        document.querySelector("#comparisonMeta"),
        document.querySelector(".target-plan-copy > p"),
        ...document.querySelectorAll(".comparison-table tbody td")
      ].map((element) => element ? {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth
      } : null),
      documentScrollHeight: document.scrollingElement.scrollHeight,
      isWindowFitted: document.body.classList.contains("is-window-fitted"),
      workspaceScale: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--workspace-scale")),
      dashboardColumns: getComputedStyle(document.querySelector(".dashboard")).gridTemplateColumns,
      resultColumns: getComputedStyle(document.querySelector(".results")).gridTemplateColumns
    };
  });
}

function isVisible(box) {
  return box && box.display !== "none" && box.visibility !== "hidden" && box.width > 0 && box.height > 0;
}

function renderedTrackCount(value) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function assertSideModuleOrder(layout, viewportName) {
  assert.deepEqual(
    layout.sideModuleOrder,
    ["price-position", "target-plan", "comparison-section", "breakdown"],
    `${viewportName}: right-column modules must follow position, target, matrix, ledger order`
  );
}

function assertContained(inner, outer, message) {
  assert(inner.left >= outer.left - 1, `${message}: left edge escaped`);
  assert(inner.right <= outer.right + 1, `${message}: right edge escaped`);
}

function assertLayout(layout, viewport, options = {}) {
  const checkLowHeight = options.checkLowHeight ?? true;
  assert(
    layout.dashboard.scrollWidth <= layout.dashboard.clientWidth + 1,
    `${viewport.name}: dashboard has horizontal overflow (${layout.dashboard.scrollWidth} > ${layout.dashboard.clientWidth})`
  );
  assertContained(layout.headerActions, layout.header, `${viewport.name}: global header actions`);
  assertSideModuleOrder(layout, viewport.name);

  if (viewport.width < 1200) {
    assert(isVisible(layout.mobileSwitcher), `${viewport.name}: compact window must expose the page switcher`);
    assert.equal(renderedTrackCount(layout.dashboardColumns), 1, `${viewport.name}: compact window must use one dashboard track`);
    if (checkLowHeight && viewport.height <= 700) {
      assert.notEqual(layout.body.overflowY, "hidden", `${viewport.name}: low-height compact window must allow vertical scrolling`);
    }
    return;
  }

  assert(!isVisible(layout.mobileSwitcher), `${viewport.name}: desktop must not expose the page switcher`);
  assert.equal(renderedTrackCount(layout.dashboardColumns), 3, `${viewport.name}: desktop dashboard must use three tracks`);
  assert.equal(renderedTrackCount(layout.resultColumns), 3, `${viewport.name}: desktop results must use three tracks`);
  if (checkLowHeight && viewport.height <= 700) {
    assert.notEqual(layout.body.overflowY, "hidden", `${viewport.name}: low-height desktop must allow vertical scrolling`);
    assert(!layout.isWindowFitted, `${viewport.name}: low-height desktop must remain in document flow`);
    assert.equal(layout.workspaceScale, 1, `${viewport.name}: low-height desktop must remain at native scale`);
    assert(
      layout.documentScrollHeight > viewport.height,
      `${viewport.name}: low-height desktop must expose a vertical scroll range`
    );
  }
  assert(
    layout.resultSide.scrollHeight <= layout.resultSide.clientHeight + 1,
    `${viewport.name}: decision column clips vertical content (${layout.resultSide.scrollHeight} > ${layout.resultSide.clientHeight})`
  );
  assert(
    layout.comparisonPanel.scrollHeight <= layout.comparisonPanel.clientHeight + 1,
    `${viewport.name}: lot matrix clips vertical content (${layout.comparisonPanel.scrollHeight} > ${layout.comparisonPanel.clientHeight})`
  );
  for (const [name, panel] of [
    ["primary result", layout.resultHero],
    ["cost flow", layout.stagePanel],
    ["market curve", layout.chartPanel]
  ]) {
    assert(
      panel.scrollHeight <= panel.clientHeight + 1,
      `${viewport.name}: ${name} panel clips vertical content (${panel.scrollHeight} > ${panel.clientHeight})`
    );
  }
  assert(layout.sidebar.width >= 294, `${viewport.name}: sidebar must be at least 294px wide`);
  assert(layout.resultSide.width >= 286, `${viewport.name}: result side column must be at least 286px wide`);
  assert(
    layout.resultMain.width >= (viewport.width >= 1280 ? 520 : 500),
    `${viewport.name}: result main column is too narrow (${layout.resultMain.width}px)`
  );
  assertContained(layout.ticketTools, layout.ticketHeader, `${viewport.name}: ticket tools`);
  assert(layout.ticketTitle.bottom <= layout.ticketTools.top + 1, `${viewport.name}: ticket title must sit above tools`);
  assert(isVisible(layout.saveLabel), `${viewport.name}: save label must remain visible`);
  assert(isVisible(layout.clearLabel), `${viewport.name}: clear label must remain visible`);
  assert(
    layout.numericStyles.every((value) => value && value.includes("tabular-nums")),
    `${viewport.name}: financial values must use tabular numeric alignment`
  );
  assert(
    layout.inputTextFits.every((measurement) => measurement && measurement.available + 0.5 >= measurement.required),
    `${viewport.name}: holding inputs must show their complete numeric values`
  );
  assert(
    layout.criticalTextFits.every((measurement) => measurement && measurement.scrollWidth <= measurement.clientWidth + 1),
    `${viewport.name}: decision labels and amounts must remain fully visible`
  );

}

async function assertShortDesktopScroll(page) {
  await page.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
  const scrollState = await page.evaluate(() => ({
    scrollY: window.scrollY,
    maxScrollY: document.scrollingElement.scrollHeight - innerHeight
  }));
  assert(scrollState.maxScrollY > 0, "1280x600: document must have a vertical scroll range");
  assert(scrollState.scrollY > 0, "1280x600: document must scroll toward the lower workspace content");
}

async function assertUsMarketLayout(page) {
  await page.locator('#marketSwitch button[data-market="us"]').click();
  await page.waitForFunction(() => document.body.dataset.market === "us");
  const state = await page.evaluate(() => {
    const input = document.querySelector("#currentCost");
    const style = getComputedStyle(input);
    const context = document.createElement("canvas").getContext("2d");
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return {
      available: input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      required: context.measureText(input.value).width,
      tracks: getComputedStyle(document.querySelector(".basis-field-grid")).gridTemplateColumns
        .trim()
        .split(/\s+/)
        .filter(Boolean).length,
      value: input.value
    };
  });
  assert.equal(state.value, "185.2", "1200x800 US: market switch must load the US example cost");
  assert.equal(state.tracks, 2, "1200x800 US: basis fields must use two visible tracks");
  assert(
    state.available + 0.5 >= state.required,
    `1200x800 US: current cost must remain fully visible (${state.available}px < ${state.required}px)`
  );
}

async function assertCompactNavigationAndTheme(page) {
  const visible = (selector) => page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  });

  assert.equal(await page.locator("body").getAttribute("data-mobile-page"), "ticket");
  assert(await visible(".sidebar-column"), "1093x700: ticket page must show transaction inputs");
  assert(!(await visible(".results")), "1093x700: ticket page must hide results");

  await page.locator('[data-mobile-page-target="results"]').click();
  assert.equal(await page.locator("body").getAttribute("data-mobile-page"), "results");
  assert(await visible(".results"), "1093x700: results page must show calculations");
  assert(!(await visible(".sidebar-column")), "1093x700: results page must hide transaction inputs");
  await page.locator(".breakdown").scrollIntoViewIfNeeded();
  assert((await page.evaluate(() => window.scrollY)) > 0, "1093x700: results page must scroll to lower decision content");

  const initialTheme = await page.locator("html").getAttribute("data-theme");
  await page.locator("#themeToggleButton").click();
  const toggledTheme = await page.locator("html").getAttribute("data-theme");
  assert.notEqual(toggledTheme, initialTheme, "1093x700: theme control must change the active theme");
  await page.locator("#themeToggleButton").click();
  assert.equal(
    await page.locator("html").getAttribute("data-theme"),
    initialTheme,
    "1093x700: second theme toggle must restore the initial theme"
  );

  await page.locator('[data-mobile-page-target="ticket"]').click();
  assert.equal(await page.locator("body").getAttribute("data-mobile-page"), "ticket");
}

async function assertCoreInteractions(page) {
  const before = await page.locator("#newDilutedCost").textContent();
  await page.locator("#buyPrice").fill("42");
  await page.locator("#buyPrice").dispatchEvent("input");
  await page.waitForFunction((previous) => {
    return document.querySelector("#newDilutedCost")?.textContent !== previous;
  }, before);
  assert.notEqual(await page.locator("#newDilutedCost").textContent(), before, "buy price must update the result");

  const plannedShares = Number((await page.locator("#targetPlanShares").textContent()).replace(/[^0-9.]/g, ""));
  await page.locator("#applyTargetPlan").click();
  assert.equal(Number(await page.locator("#buyShares").inputValue()), plannedShares, "target action must apply its planned shares");
}

async function assertDialog(page, buttonSelector, dialogSelector, viewportName) {
  await page.locator(buttonSelector).click();
  const dialog = page.locator(dialogSelector);
  await dialog.waitFor({ state: "visible" });
  try {
    const geometry = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const body = element.querySelector(".dialog-body");
      const bodyStyle = body ? getComputedStyle(body) : null;
      return {
        rect: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left },
        viewport: { width: innerWidth, height: innerHeight },
        bodyOverflowY: bodyStyle ? bodyStyle.overflowY : null
      };
    });
    assert(geometry.rect.top >= 0, `${viewportName}: ${dialogSelector} escaped above the viewport`);
    assert(geometry.rect.left >= 0, `${viewportName}: ${dialogSelector} escaped left of the viewport`);
    assert(geometry.rect.right <= geometry.viewport.width, `${viewportName}: ${dialogSelector} escaped right of the viewport`);
    assert(geometry.rect.bottom <= geometry.viewport.height, `${viewportName}: ${dialogSelector} escaped below the viewport`);
    assert.equal(geometry.bodyOverflowY, "auto", `${viewportName}: ${dialogSelector} body must scroll`);
  } finally {
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
  }
}

const { server, url } = await startStaticServer();
const browser = await chromium.launch({ channel: "chrome", headless: true });
let failures = 0;

try {
  await mkdir(artifactDir, { recursive: true });
  const page = await browser.newPage();
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(url, { waitUntil: "networkidle" });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((nextTheme) => {
        document.documentElement.dataset.theme = nextTheme;
      }, theme);
      try {
        assertLayout(await readLayout(page), viewport, {
          checkLowHeight: !compactOnly || viewport.name === "1280x600"
        });
        console.log(`PASS ${viewport.name} ${theme}`);
      } catch (error) {
        failures += 1;
        console.error(`FAIL ${viewport.name} ${theme}: ${error.message}`);
      }
      if (["1093x700", "1280x720", "1366x768", "1440x900", "3840x2160"].includes(viewport.name)) {
        await page.screenshot({ path: join(artifactDir, `${viewport.name}-${theme}.png`), fullPage: true });
      }
    }
  }

  if (!compactOnly) {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(url, { waitUntil: "networkidle" });
    try {
      await assertUsMarketLayout(page);
      console.log("PASS 1200x800 US market layout");
    } catch (error) {
      failures += 1;
      console.error(`FAIL 1200x800 US market layout: ${error.message}`);
    }

    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto(url, { waitUntil: "networkidle" });
    try {
      await assertShortDesktopScroll(page);
      console.log("PASS 1280x600 native scrolling");
    } catch (error) {
      failures += 1;
      console.error(`FAIL 1280x600 native scrolling: ${error.message}`);
    }

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(url, { waitUntil: "networkidle" });
    try {
      await assertCoreInteractions(page);
      console.log("PASS 1280x720 core interactions");
    } catch (error) {
      failures += 1;
      console.error(`FAIL 1280x720 core interactions: ${error.message}`);
    }

    await page.setViewportSize({ width: 1093, height: 700 });
    await page.goto(url, { waitUntil: "networkidle" });
    try {
      await assertCompactNavigationAndTheme(page);
      console.log("PASS 1093x700 compact navigation and theme toggle");
    } catch (error) {
      failures += 1;
      console.error(`FAIL 1093x700 compact navigation and theme toggle: ${error.message}`);
    }

    for (const [button, dialog] of [
      ["#feeSettingsButton", "#feeDialog"],
      ["#supportFeedbackButton", "#supportDialog"]
    ]) {
      try {
        await assertDialog(page, button, dialog, "1093x700");
        console.log(`PASS 1093x700 ${dialog}`);
      } catch (error) {
        failures += 1;
        console.error(`FAIL 1093x700 ${dialog}: ${error.message}`);
      }
    }
  }
} finally {
  await browser.close();
  await new Promise((accept) => server.close(accept));
}

if (failures > 0) {
  console.error(`${failures} responsive assertion(s) failed`);
  process.exitCode = 1;
} else {
  console.log(`All ${viewports.length} responsive viewport(s) passed`);
}
