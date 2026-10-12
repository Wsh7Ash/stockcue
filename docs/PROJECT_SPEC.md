# stockcue - project specification

## Name

stockcue

## Category

business-automation

## Target user

A small retail shop owner (or their assistant) who already tracks daily sales
and stock levels in a spreadsheet, has 10-200 SKUs, and places supplier orders
on a weekly-ish cadence. Non-developer: the entry point is double-clicking
`index.html`.

## Problem

Small shops usually reorder by gut feel or by scanning a spreadsheet column of
"current stock". That misses the interaction between sales velocity, supplier
lead time, and the safety buffer they actually need. The tools that do this
math properly are inventory suites aimed at bigger businesses: accounts,
subscriptions, cloud uploads of sales data. The shop owner either over-orders
(cash tied up) or under-orders (stockouts), and no lightweight offline tool
exists for the "just tell me what to order this week" question.

## Solution

stockcue is a single offline web page. Load the built-in sample shop or import
two CSVs (sales history, current inventory), tweak lead time / review cadence /
safety-stock settings, and read an urgency-ranked table: which SKUs to order,
how many units, and a plain-language why for every row. Export the order list
as CSV for the supplier email. All parsing and math runs in the browser; data
never leaves the machine.

## Core workflow

1. Open `index.html` (double-click; works over `file://`).
2. Click **Load sample shop** (or import sales + inventory CSVs).
3. Adjust safety-stock mode (manual/auto), service level, and review days.
4. Read the urgency-sorted table; edit a SKU's lead time inline if needed.
5. Click **Export order list CSV** and send the file to your suppliers.

## Must-have features

- Reorder math: average daily demand, demand stddev (zero-filled daily
  series), reorder point, manual + auto safety stock (z-table 1.28/1.65/2.33),
  suggested order quantity with review-days horizon, days of cover.
- Urgency classification: critical / order / watch / ok / no-demand, with
  boundary semantics documented in `docs/ARCHITECTURE.md`.
- Urgency-sorted main table with row highlighting, urgency badges, and a
  plain-language "why" per row.
- Summary strip (counts per urgency, total SKUs, sales window).
- Inline editable per-SKU lead time with live recalculation.
- Built-in deterministic sample shop (12 SKUs, 72-day window) - no
  `Math.random()`.
- CSV import (sales `date,sku,qty`; inventory
  `sku,name,on_hand,lead_time_days,supplier`) via FileReader, graceful error
  messages for malformed files.
- CSV export of the order list (`sku,name,action,suggested_qty,on_hand,
  lead_time_days,supplier,urgency`).
- Empty state, error state, assumptions/disclaimer panel.
- Works from `file://`: no fetch, no ES modules, no CDN, no build step.
- Node-based test suite (`node --test`) with no npm install.

## Nice-to-have features

- Headless-browser smoke test (`tools/smoke.mjs`) when Chrome/Edge is present.
- CI workflow that re-runs the artifact generator to prove determinism.
- Keyboard-usable controls, semantic table markup, AA-contrast badges.

## Stack

- Plain HTML + CSS + vanilla JavaScript (classic scripts, UMD-style guards).
- Node 24 built-in test runner (`node --test`) for logic tests; zero
  dependencies, no package.json required to run tests.

## Test strategy

- CSV parser: quotes, escaped quotes, commas in quotes, CRLF/CR/LF, trailing
  newline, empty fields, multi-line quoted fields, malformed input errors,
  header parsing, column-count mismatch, round-trip through `stringify`.
- Calc: avg daily demand (with and without explicit window), population
  stddev, zero-filled daily series, manual/auto safety stock, z-table lookups,
  reorder point ceil behavior (including exact-integer no-bump), suggestion
  quantity (positive and clamped-to-zero), all five urgency branches including
  the `on_hand == reorder_point` boundary, zero-demand SKU, per-SKU lead
  overrides, sort order, summary counts.
- Sample determinism: two generations are deep-equal; window shape; the
  zero-demand SKU has no rows.
- Consistency: `examples/*.csv` equal the built-in generator output.
- Export shape: headers, urgency sort preserved, CRLF + parser round-trip,
  escaping of commas/quotes in names.
- HTML sanity: classic script tags present, no `type="module"`, no remote
  URLs, no fetch/XHR/import/export anywhere in `src/`.
- Render: row classes, HTML escaping of untrusted text, empty state, summary.
- Optional real-browser smoke test via headless Chrome (`tools/smoke.mjs`).

## Demo/result strategy

`tools/generate-artifacts.cjs` evaluates the sample shop with default UI
settings and writes committed artifacts: `results/order-list.csv`,
`results/table-snapshot.txt`, `results/demo.md`. `RESULTS.md` pastes the real
`node --test` summary and the computed per-SKU table. CI regenerates the
artifacts and fails on any drift, proving the committed demo is reproducible.

## Safety considerations

- No network access of any kind: no fetch, no CDN, no fonts, no telemetry.
- CSVs are parsed client-side only; files never leave the machine.
- Output is advisory decision support, not financial or purchasing advice;
  the UI carries an assumptions/disclaimer panel.
- The render layer HTML-escapes all data-derived strings (SKU, name, why).
- No secrets, no absolute machine paths, ASCII-only sources.

## Definition of done

- `node --test tests\` passes with exit 0 (>= 30 test cases).
- `index.html` opens over `file://` and the full workflow works offline.
- Sample shop, examples CSVs, and results artifacts are deterministic and
  mutually consistent (enforced by tests + CI drift check).
- Docs (README, ARCHITECTURE, USAGE, PROJECT_SPEC) describe the real
  behavior; RESULTS.md contains observed output only.
