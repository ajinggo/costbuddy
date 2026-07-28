# CostBuddy Three-Column Responsive Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve CostBuddy's original three-column desktop workstation while making it readable at common laptop widths, applying the approved refined-finance visual language, and using the existing paged layout below the minimum comfortable three-column width.

**Architecture:** Keep the static HTML and vanilla JavaScript application. Normalize the CSS and JavaScript desktop boundary to `1200px`, move the price-position section ahead of target planning in DOM order, and add one final desktop styling layer that gives the center result column priority while preserving the left input and right decision columns. Extend the existing Playwright geometry harness first so the current implementation fails against the new breakpoint, column-width, DOM-order, and numeric-readability requirements.

**Tech Stack:** HTML5, CSS Grid/Flexbox, vanilla JavaScript, Node.js 24, Playwright 1.61.1, local Chrome.

---

Repository root: `/Users/yeguanxi/Documents/New project/costbuddy`

Design reference: `docs/superpowers/specs/2026-07-28-desktop-responsive-design.md`

## File Map

- Modify `tests/responsive-layout.mjs`: encode the `1200px` boundary, minimum comfortable column widths, right-column DOM order, low-height scrolling, numeric alignment, screenshots, dialogs, and a core calculation smoke test.
- Modify `calculator.js`: align workspace fitting with the CSS breakpoint so `1000-1199px` does not receive desktop scaling behavior.
- Modify `index.html`: move the price-position module to the top of the right column and bump CSS/JavaScript cache keys.
- Modify `styles.css`: normalize historical breakpoint queries and append the approved A+B three-column visual layer.
- Modify `.gitignore`: exclude `.superpowers/` visual-brainstorm files from Git.
- Modify `README.md`: describe the new desktop boundary and verification viewport set.
- Modify `docs/superpowers/specs/2026-07-28-desktop-responsive-design.md`: record the physically achievable `1200px`/`1280px` center-column minima discovered during plan self-review.

## Task 1: Make the New Responsive Contract Fail First

**Files:**

- Modify: `tests/responsive-layout.mjs:8-219`
- Test: `tests/responsive-layout.mjs`

- [ ] **Step 1: Install the pinned development dependency if it is absent**

Run:

```bash
npm install
```

Expected: exit status `0`; `node_modules/playwright` exists and `package-lock.json` remains pinned to Playwright `1.61.1`.

- [ ] **Step 2: Replace the viewport lists with boundary-focused coverage**

Replace the current `viewports` declaration with:

```javascript
const compactOnly = process.argv.includes("--compact");
const viewports = compactOnly
  ? [
      { name: "1093x700", width: 1093, height: 700 },
      { name: "1200x800", width: 1200, height: 800 },
      { name: "1280x720", width: 1280, height: 720 }
    ]
  : [
      { name: "900x768", width: 900, height: 768 },
      { name: "1024x768", width: 1024, height: 768 },
      { name: "1093x700", width: 1093, height: 700 },
      { name: "1200x800", width: 1200, height: 800 },
      { name: "1280x720", width: 1280, height: 720 },
      { name: "1366x768", width: 1366, height: 768 },
      { name: "1440x900", width: 1440, height: 900 },
      { name: "1600x900", width: 1600, height: 900 },
      { name: "1920x1080", width: 1920, height: 1080 },
      { name: "2560x1440", width: 2560, height: 1440 },
      { name: "3840x2160", width: 3840, height: 2160 }
    ];
```

- [ ] **Step 3: Extend `readLayout()` with column, order, and numeric-style measurements**

Add these properties to the object returned by `page.evaluate()`:

```javascript
      sidebar: measure(".sidebar-column"),
      results: measure(".results"),
      resultMain: measure(".result-main-column"),
      resultSide: measure(".result-side-column"),
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
      dashboardColumns: getComputedStyle(document.querySelector(".dashboard")).gridTemplateColumns,
      resultColumns: getComputedStyle(document.querySelector(".results")).gridTemplateColumns
```

Remove the old duplicate `dashboardColumns` property at the bottom of the return object.

- [ ] **Step 4: Add stable helpers for grid-column counting and module order**

Insert after `isVisible()`:

```javascript
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
```

- [ ] **Step 5: Replace `assertLayout()` with the new breakpoint and comfort assertions**

Use this implementation:

```javascript
function assertLayout(layout, viewport, options = {}) {
  const checkLowHeight = options.checkLowHeight ?? true;
  assert(
    layout.dashboard.scrollWidth <= layout.dashboard.clientWidth + 1,
    `${viewport.name}: dashboard has horizontal overflow (${layout.dashboard.scrollWidth} > ${layout.dashboard.clientWidth})`
  );
  assertContained(layout.headerActions, layout.header, `${viewport.name}: global header actions`);
  assertSideModuleOrder(layout, viewport.name);

  if (viewport.width < 1200) {
    assert(isVisible(layout.mobileSwitcher), `${viewport.name}: narrow computer window must expose the page switcher`);
    assert.equal(renderedTrackCount(layout.dashboardColumns), 1, `${viewport.name}: narrow computer window must use one dashboard column`);
    if (checkLowHeight && viewport.height <= 700) {
      assert.notEqual(layout.body.overflowY, "hidden", `${viewport.name}: low-height paged layout must scroll`);
    }
    return;
  }

  assert(!isVisible(layout.mobileSwitcher), `${viewport.name}: three-column desktop must hide the page switcher`);
  assert.equal(renderedTrackCount(layout.dashboardColumns), 3, `${viewport.name}: dashboard must render sidebar, divider, and results tracks`);
  assert.equal(renderedTrackCount(layout.resultColumns), 3, `${viewport.name}: results must render core, divider, and decision tracks`);
  assert(layout.sidebar.width >= 294, `${viewport.name}: input column is too narrow (${layout.sidebar.width}px)`);
  assert(layout.resultSide.width >= 286, `${viewport.name}: decision column is too narrow (${layout.resultSide.width}px)`);
  assert(
    layout.resultMain.width >= (viewport.width >= 1280 ? 520 : 500),
    `${viewport.name}: core result column is too narrow (${layout.resultMain.width}px)`
  );
  assertContained(layout.ticketTools, layout.ticketHeader, `${viewport.name}: ticket tools`);
  assert(
    layout.ticketTitle.bottom <= layout.ticketTools.top + 1,
    `${viewport.name}: ticket title must sit above the three tool buttons`
  );
  assert(isVisible(layout.saveLabel), `${viewport.name}: save label must remain visible`);
  assert(isVisible(layout.clearLabel), `${viewport.name}: clear label must remain visible`);
  assert(
    layout.numericStyles.every((value) => value && value.includes("tabular-nums")),
    `${viewport.name}: financial values must use tabular numeric alignment`
  );

  if (checkLowHeight && viewport.height <= 700) {
    assert.notEqual(layout.body.overflowY, "hidden", `${viewport.name}: low-height desktop must allow vertical scrolling`);
  }
}
```

- [ ] **Step 6: Add an interaction smoke test for calculation and target-plan application**

Insert before the main browser loop:

```javascript
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
```

In the non-compact verification block, run it at `1280x720` before dialog checks:

```javascript
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(url, { waitUntil: "networkidle" });
    await assertCoreInteractions(page);
    console.log("PASS 1280x720 core interactions");
```

- [ ] **Step 7: Update the screenshot viewport list**

Replace the screenshot condition with:

```javascript
      if (["1093x700", "1280x720", "1366x768", "1440x900", "3840x2160"].includes(viewport.name)) {
        await page.screenshot({ path: join(artifactDir, `${viewport.name}-${theme}.png`), fullPage: true });
      }
```

- [ ] **Step 8: Run the compact suite and verify RED**

Run:

```bash
npm run test:responsive:compact
```

Expected: exit status `1`. The old page must fail because `1093x700` does not expose the page switcher, the right column begins with `target-plan`, and the compact desktop columns do not satisfy the new mode and width contract.

## Task 2: Align JavaScript, DOM Order, and CSS Breakpoints

**Files:**

- Modify: `calculator.js:12-14`
- Modify: `index.html:377-446`
- Modify: `styles.css:2198-5595`
- Test: `tests/responsive-layout.mjs`

- [ ] **Step 1: Align workspace fitting with the `1200px` desktop boundary**

Replace the constants at the top of `calculator.js` with:

```javascript
  var WORKSPACE_MIN_WIDTH = 1200;
  var WORKSPACE_MIN_HEIGHT = 660;
  var MOBILE_LAYOUT_QUERY = "(max-width: 1199px), (max-height: 520px) and (pointer: coarse)";
```

This prevents the JavaScript workspace scaler from treating `1000-1199px` as a desktop canvas while CSS treats it as paged content.

- [ ] **Step 2: Move the price-position section to the top of the decision column**

Move the existing `index.html:431-446` block verbatim so it becomes the first child inside `.result-side-column`, immediately after its opening tag and before `.target-plan`. The resulting start of the right column must be exactly:

```html
        <div class="result-column result-side-column">
          <section class="price-position panel" aria-labelledby="positionTitle">
            <div class="section-title-row compact-title-row">
              <div>
                <p class="panel-kicker">PRICE / BASIS</p>
                <h2 id="positionTitle">目前股价与回本价</h2>
              </div>
              <span id="positionSummary">49.00/92.23</span>
            </div>
            <div class="position-visual">
              <div class="position-track" aria-hidden="true">
                <div class="position-fill" id="positionFill"></div>
                <span class="position-dot" id="positionDot"></span>
              </div>
              <div class="position-labels"><span data-position-zero>HK$0</span><span id="breakEvenLabel">回本 HK$92.23</span></div>
            </div>
          </section>

          <section class="target-plan panel" aria-labelledby="targetPlanTitle">
```

Keep `.comparison-section` after `.target-plan` and `.breakdown` last. Do not duplicate or rename IDs.

- [ ] **Step 3: Normalize mobile media-query upper bounds**

In `styles.css`, change every layout query with this exact prefix:

```css
@media (max-width: 999px), (max-height: 520px) and (pointer: coarse)
```

to:

```css
@media (max-width: 1199px), (max-height: 520px) and (pointer: coarse)
```

The affected query starts are currently near lines `2198`, `3524`, `3692`, `3746`, `4041`, `4219`, `4242`, `4840`, and `5455`. Verify the final file has no remaining `max-width: 999px` layout query.

- [ ] **Step 4: Normalize desktop media-query lower bounds**

Change the generic desktop query prefix:

```css
@media (min-width: 1000px)
```

to:

```css
@media (min-width: 1200px)
```

Apply this to the desktop query starts currently near lines `2911`, `3038`, `3932`, `4058`, `4256`, and `5595`. Also change the support-button query near line `4830` from:

```css
@media (min-width: 1000px) and (max-width: 1400px) and (min-height: 521px)
```

to:

```css
@media (min-width: 1200px) and (max-width: 1439px) and (min-height: 521px)
```

- [ ] **Step 5: Remove obsolete `1000-1180px` desktop-only overrides**

Delete both complete media blocks that begin with:

```css
@media (max-width: 1180px) and (min-width: 1000px)
```

One hides the clear-plan text; the other compresses header and metrics. The expanded paged-layout queries now own this width range and must keep the full labels.

Inside the desktop refresh block near the old line `3439`, change its nested query from `@media (max-width: 1180px)` to `@media (max-width: 1439px)` so it remains useful for compact three-column desktops.

- [ ] **Step 6: Repurpose the old compact-desktop consolidation block**

Change the final block near the old line `5523` from:

```css
@media (min-width: 1000px) and (max-width: 1199px)
```

to:

```css
@media (min-width: 1200px) and (max-width: 1439px)
```

Replace its `.dashboard` and `.results` declarations with:

```css
  .dashboard {
    grid-template-columns: clamp(294px, 25.4vw, 322px) 1px minmax(0, 1fr);
    column-gap: 8px;
  }

  .results {
    grid-template-columns: minmax(500px, 1.72fr) 1px minmax(286px, .96fr);
    column-gap: 8px;
  }
```

Keep the existing two-row `.controls-header` and three-button `.controls-header-tools` rules in that block.

- [ ] **Step 7: Verify boundary consistency and syntax**

Run:

```bash
rg -n "max-width: 999px|min-width: 1000px|MOBILE_LAYOUT_QUERY|WORKSPACE_MIN_WIDTH" styles.css calculator.js
node --check calculator.js
npm run test:responsive:compact
```

Expected: `rg` returns only the updated JavaScript constants and no old CSS boundary; `node --check` exits `0`. The compact test may still fail numeric-style or visual-width assertions, but `1093x700` must now pass the paged-layout assertions and the right-column order assertion must pass.

- [ ] **Step 8: Commit the contract and structural boundary**

Run:

```bash
git add calculator.js index.html styles.css tests/responsive-layout.mjs
git commit -m "fix: align three-column responsive boundary"
```

Expected: commit succeeds on `codex/desktop-responsive` and includes only the four listed files.

## Task 3: Apply the Approved A+B Three-Column Visual Layer

**Files:**

- Modify: `styles.css` after the existing dialog containment rules
- Test: `tests/responsive-layout.mjs`

- [ ] **Step 1: Append the shared refined-finance desktop layer**

Append this block to `styles.css`:

```css
/* Final three-column desktop refinement: refined finance shell with terminal-grade data clarity. */
@media (min-width: 1200px) and (min-height: 521px) {
  .dashboard {
    row-gap: 10px;
    padding: 0 12px 12px;
    border-color: #dfe3ec;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(16, 24, 40, .07);
  }

  .app-header {
    min-width: 0;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 12px;
    border-radius: 12px 12px 0 0;
  }

  .header-actions,
  .controls-header,
  .controls-header-tools,
  .result-column,
  .result-column > *,
  .section-title-row,
  .section-title-row > div {
    min-width: 0;
  }

  .controls {
    grid-template-rows: 66px minmax(0, .94fr) minmax(0, 1fr) minmax(0, 1fr);
    gap: 9px;
  }

  .controls-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 30px;
    align-content: start;
    gap: 7px;
    padding: 0 2px 8px;
  }

  .controls-header > div:first-child {
    justify-content: flex-start;
    gap: 9px;
  }

  .controls-header-tools {
    display: grid;
    width: 100%;
    grid-template-columns: 1.15fr 1fr .82fr;
    gap: 6px;
  }

  .save-holding-button,
  .fee-mode-button,
  .clear-plan-control,
  .clear-plan-button {
    width: 100%;
    min-width: 0;
  }

  .save-holding-button,
  .fee-mode-button,
  .clear-plan-button {
    height: 30px;
    justify-content: center;
    padding-inline: 7px;
    border-radius: 7px;
  }

  .control-section,
  .result-hero,
  .stage-section,
  .chart-section,
  .target-plan,
  .comparison-section,
  .price-position,
  .breakdown,
  .metric-grid {
    border-color: #dfe3ec;
    border-radius: 8px;
    box-shadow: none;
  }

  .control-section {
    padding: 10px 11px 11px;
  }

  .result-column {
    gap: 9px;
  }

  .result-main-column {
    grid-template-rows: 136px 70px 108px minmax(250px, 1fr);
  }

  .result-side-column {
    grid-template-rows: 84px 160px minmax(214px, 1fr) 132px;
  }

  .result-hero {
    grid-template-columns: minmax(0, 1.42fr) minmax(160px, .7fr);
    gap: 14px;
    padding: 15px 16px;
    border-left: 3px solid var(--blue);
    background: rgba(83, 111, 240, .025);
  }

  .hero-number span {
    font-size: clamp(46px, 4vw, 56px);
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
  }

  .cashflow-card {
    padding: 10px 4px 10px 15px;
    border-left-color: #dfe3ec;
  }

  .metric-grid {
    gap: 0;
    overflow: hidden;
  }

  .metric-grid .metric {
    justify-content: center;
    padding: 10px 9px;
    border: 0;
    border-right: 1px solid #e7eaf0;
    border-radius: 0;
  }

  .metric-grid .metric:last-child {
    border-right: 0;
  }

  .metric-icon {
    display: none;
  }

  .target-plan,
  .stage-section,
  .chart-section,
  .comparison-section,
  .price-position,
  .breakdown {
    padding: 11px 12px;
  }

  .section-title-row {
    gap: 8px;
    margin-bottom: 9px;
  }

  .controls-header .panel-kicker,
  .section-title-row .panel-kicker,
  .brand-group .eyebrow,
  .app-header h1,
  .controls-header h2,
  .section-title-row h2 {
    letter-spacing: 0;
  }

  .section-title-row > span,
  #positionSummary,
  #comparisonMeta {
    min-width: 0;
    overflow: hidden;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stage-section .stage-grid {
    overflow: hidden;
    border-color: #e7eaf0;
    border-radius: 7px;
  }

  .result-main-column .stage-card {
    border-radius: 0;
  }

  .price-position {
    border-top: 3px solid var(--blue);
  }

  .position-track {
    height: 6px;
  }

  .comparison-section .table-scroll {
    height: calc(100% - 32px);
  }

  .comparison-table {
    table-layout: fixed;
  }

  .comparison-table :is(th, td):nth-child(1) { width: 15%; }
  .comparison-table :is(th, td):nth-child(2) { width: 17%; text-align: right; }
  .comparison-table :is(th, td):nth-child(3) { width: 29%; text-align: right; }
  .comparison-table :is(th, td):nth-child(4) { width: 24%; text-align: right; }
  .comparison-table :is(th, td):nth-child(5) { width: 15%; text-align: right; }

  .comparison-table th,
  .comparison-table td {
    border-bottom-color: #e7eaf0;
    font-variant-numeric: tabular-nums;
  }

  :is(
    #newDilutedCost,
    #netCashFlow,
    #finalShares,
    #recoverableCost,
    #totalPnl,
    #breakEvenGap,
    #beforeStageCost,
    #afterSellStageCost,
    #afterBuyStageCost,
    #targetPlanShares,
    #targetPlanOutlay,
    #targetPlanActualCost,
    #positionSummary,
    #originalBasis,
    #netSaleProceeds,
    #buyOutlay,
    #totalFees
  ) {
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
  }

  .breakdown dl > div {
    padding-block: 5px;
    border-bottom-color: #e7eaf0;
  }
}
```

- [ ] **Step 2: Add the compact three-column allocation and header priorities**

Append immediately after the shared block:

```css
@media (min-width: 1200px) and (max-width: 1439px) and (min-height: 521px) {
  .dashboard {
    grid-template-columns: clamp(294px, 25.4vw, 322px) 1px minmax(0, 1fr);
    column-gap: 8px;
  }

  .results {
    grid-template-columns: minmax(500px, 1.72fr) 1px minmax(286px, .96fr);
    column-gap: 8px;
  }

  .header-disclaimer {
    display: none;
  }

  .app-header {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .header-actions {
    justify-self: end;
  }

  .local-badge {
    display: none;
  }
}
```

- [ ] **Step 3: Add the standard-width allocation**

Append:

```css
@media (min-width: 1440px) and (max-width: 2199px) and (min-height: 521px) {
  .dashboard {
    grid-template-columns: clamp(330px, 23.5vw, 358px) 1px minmax(0, 1fr);
    column-gap: 10px;
  }

  .results {
    grid-template-columns: minmax(560px, 1.68fr) 1px minmax(330px, 1fr);
    column-gap: 10px;
  }
}
```

- [ ] **Step 4: Add matching dark-theme clarity without a terminal redesign**

Append:

```css
@media (min-width: 1200px) and (min-height: 521px) {
  html[data-theme="dark"] .dashboard,
  html[data-theme="dark"] .control-section,
  html[data-theme="dark"] .result-hero,
  html[data-theme="dark"] .stage-section,
  html[data-theme="dark"] .chart-section,
  html[data-theme="dark"] .target-plan,
  html[data-theme="dark"] .comparison-section,
  html[data-theme="dark"] .price-position,
  html[data-theme="dark"] .breakdown,
  html[data-theme="dark"] .metric-grid {
    border-color: var(--line);
    box-shadow: none;
  }

  html[data-theme="dark"] .result-hero {
    background: rgba(29, 155, 240, .035);
  }

  html[data-theme="dark"] .metric-grid .metric,
  html[data-theme="dark"] .comparison-table th,
  html[data-theme="dark"] .comparison-table td,
  html[data-theme="dark"] .breakdown dl > div {
    border-color: #263746;
  }
}
```

- [ ] **Step 5: Run the compact suite and verify GREEN**

Run:

```bash
npm run test:responsive:compact
```

Expected: `PASS` for `1093x700`, `1200x800`, and `1280x720` in both themes, followed by `All 3 responsive viewport(s) passed`.

- [ ] **Step 6: Inspect compact screenshots before committing**

Open these generated files:

```text
test-artifacts/responsive/1093x700-light.png
test-artifacts/responsive/1093x700-dark.png
test-artifacts/responsive/1280x720-light.png
test-artifacts/responsive/1280x720-dark.png
```

Check that `1093x700` uses the page switcher; `1280x720` shows three readable columns; the title/tools are separate; the center result is the visual focus; the right column begins with price position; and no amount or table action is clipped.

- [ ] **Step 7: Commit the approved visual layer**

Run:

```bash
git add styles.css
git commit -m "style: refine three-column desktop workflow"
```

Expected: commit succeeds and contains only `styles.css`.

## Task 4: Cache Keys, Documentation, and Full Regression

**Files:**

- Modify: `index.html:12,775`
- Modify: `.gitignore`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-28-desktop-responsive-design.md`
- Test: `tests/responsive-layout.mjs`

- [ ] **Step 1: Bump both browser cache keys**

Change the stylesheet link to:

```html
  <link rel="stylesheet" href="styles.css?v=20260728-61">
```

Change the script tag to:

```html
  <script src="calculator.js?v=20260728-33"></script>
```

- [ ] **Step 2: Ignore visual-brainstorm sessions**

Append to `.gitignore`:

```gitignore
.superpowers/
```

The complete file must contain:

```gitignore
node_modules/
test-artifacts/
.superpowers/
```

- [ ] **Step 3: Update README responsive behavior and verification viewports**

In the “多端体验” description, replace “桌面一屏三列工作台” with:

```markdown
<li>1200px 以上三列工作台，窄窗口使用输入 / 结果分页</li>
```

In the local verification section, document that `npm run test:responsive` checks `1093x700` paged mode, `1200x800` boundary mode, `1280x720` and `1366x768` laptop workstations, standard desktop, 2K, and 4K in light and dark themes.

- [ ] **Step 4: Confirm the design-spec feasibility correction**

Verify the design spec contains both exact requirements:

```text
1200px 下中列不得低于约 500px
从 1280px 起不得低于约 520px
```

No other design requirement changes in this task.

- [ ] **Step 5: Run syntax, whitespace, and full responsive verification**

Run:

```bash
node --check calculator.js
npm run test:responsive
git diff --check
```

Expected: JavaScript syntax exits `0`; all 11 viewports pass in light and dark themes; core interactions and both tested dialogs pass; `git diff --check` prints nothing.

- [ ] **Step 6: Inspect all required representative screenshots**

Open and inspect:

```text
test-artifacts/responsive/1093x700-light.png
test-artifacts/responsive/1093x700-dark.png
test-artifacts/responsive/1280x720-light.png
test-artifacts/responsive/1280x720-dark.png
test-artifacts/responsive/1366x768-light.png
test-artifacts/responsive/1366x768-dark.png
test-artifacts/responsive/1440x900-light.png
test-artifacts/responsive/1440x900-dark.png
test-artifacts/responsive/3840x2160-light.png
test-artifacts/responsive/3840x2160-dark.png
```

Reject the implementation if any screenshot shows overlap, clipped text, unreadably small labels, incoherent empty space, a blank chart, the wrong right-column order, or a visually dominant auxiliary module.

- [ ] **Step 7: Commit documentation and verification metadata**

Run:

```bash
git add .gitignore README.md index.html docs/superpowers/specs/2026-07-28-desktop-responsive-design.md tests/responsive-layout.mjs
git commit -m "docs: finalize responsive verification contract"
```

Expected: commit succeeds with only the five listed files.

## Task 5: Final Browser Check and Feature-Branch Push

**Files:**

- Verify: `index.html`
- Verify: `styles.css`
- Verify: `calculator.js`
- Verify: `tests/responsive-layout.mjs`

- [ ] **Step 1: Confirm the working tree and commit history**

Run:

```bash
git status --short
git log -5 --oneline --decorate
```

Expected: the working tree is clean; the latest commits are the responsive boundary, three-column visual refinement, and verification documentation commits on `codex/desktop-responsive`.

- [ ] **Step 2: Start or reuse the local preview server**

If `http://127.0.0.1:8765/` is already serving this repository, reuse it. Otherwise run:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Expected: the app is reachable at `http://127.0.0.1:8765/`.

- [ ] **Step 3: Perform the final user-workflow browser check**

At `1280x720` in light and dark themes:

1. Confirm all three columns are visible.
2. Change the buy price and verify the hero, chart, and matrix update.
3. Apply a target plan and verify buy shares update.
4. Open and close fee settings and support dialogs.
5. Confirm right-column keyboard order matches price position, target plan, lot matrix, and ledger.

At `1093x700`, confirm the “交易参数 / 测算结果” switcher works and both pages remain vertically scrollable.

- [ ] **Step 4: Push only the feature branch**

Run:

```bash
git push origin codex/desktop-responsive
```

Expected: GitHub reports the feature branch updated successfully. Do not merge `main`, create a production deployment, or change the remote target.

- [ ] **Step 5: Report the handoff**

Report the local preview URL, the tested viewport set, the final commit IDs, and that `main` remains unchanged. Include any residual visual risk discovered during screenshot review instead of describing the implementation as complete if a target viewport still looks crowded.
