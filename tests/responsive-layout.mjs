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
      { name: "1024x768", width: 1024, height: 768 },
      { name: "1093x700", width: 1093, height: 700 }
    ]
  : [
      { name: "900x768", width: 900, height: 768 },
      { name: "1024x768", width: 1024, height: 768 },
      { name: "1093x700", width: 1093, height: 700 },
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
      header: measure(".app-header"),
      headerActions: measure(".header-actions"),
      ticketHeader: measure(".controls-header"),
      ticketTitle: measure(".controls-header > div:first-child"),
      ticketTools: measure(".controls-header-tools"),
      saveLabel: measure("#saveHoldingLabel"),
      clearLabel: measure("#clearPlanButton > span"),
      mobileSwitcher: measure(".mobile-page-switcher"),
      dashboardColumns: getComputedStyle(document.querySelector(".dashboard")).gridTemplateColumns
    };
  });
}

function isVisible(box) {
  return box && box.display !== "none" && box.visibility !== "hidden" && box.width > 0 && box.height > 0;
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

  if (viewport.width < 1000) {
    assert(isVisible(layout.mobileSwitcher), `${viewport.name}: narrow window must expose the page switcher`);
    assert(!layout.dashboardColumns.trim().includes(" "), `${viewport.name}: narrow window must use one dashboard column`);
    return;
  }

  assert(!isVisible(layout.mobileSwitcher), `${viewport.name}: desktop must not expose the mobile page switcher`);
  assert(
    layout.ticketTitle.scrollWidth <= layout.ticketTitle.clientWidth + 1,
    `${viewport.name}: ticket title is clipped (${layout.ticketTitle.scrollWidth} > ${layout.ticketTitle.clientWidth})`
  );
  assertContained(layout.ticketTools, layout.ticketHeader, `${viewport.name}: ticket tools`);

  if (viewport.width < 1200) {
    assert(
      layout.ticketTitle.bottom <= layout.ticketTools.top + 1,
      `${viewport.name}: compact ticket title must sit above tools`
    );
    assert(isVisible(layout.saveLabel), `${viewport.name}: save label must remain visible`);
    assert(isVisible(layout.clearLabel), `${viewport.name}: clear label must remain visible`);
  }

  if (checkLowHeight && viewport.height <= 700) {
    assert.notEqual(layout.body.overflowY, "hidden", `${viewport.name}: low-height desktop must allow vertical scrolling`);
  }
}

async function assertDialog(page, buttonSelector, dialogSelector, viewportName) {
  await page.locator(buttonSelector).click();
  const dialog = page.locator(dialogSelector);
  await dialog.waitFor({ state: "visible" });
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
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
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
        assertLayout(await readLayout(page), viewport, { checkLowHeight: !compactOnly });
        console.log(`PASS ${viewport.name} ${theme}`);
      } catch (error) {
        failures += 1;
        console.error(`FAIL ${viewport.name} ${theme}: ${error.message}`);
      }
      if (["1093x700", "1440x900", "3840x2160"].includes(viewport.name)) {
        await page.screenshot({ path: join(artifactDir, `${viewport.name}-${theme}.png`), fullPage: true });
      }
    }
  }

  if (!compactOnly) {
    await page.setViewportSize({ width: 1093, height: 700 });
    await page.goto(url, { waitUntil: "networkidle" });
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
