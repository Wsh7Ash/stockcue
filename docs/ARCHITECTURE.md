# stockcue architecture

stockcue is a static, offline web page. There is no build step, no framework,
and no network access. Everything is classic `<script src>` tags evaluated in
order, each wrapped in a UMD-style guard so the same file works as a browser
global *and* as a CommonJS module for Node tests:

```js
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.StockcueCalc = factory();
  }
})(typeof self !== "undefined" ? self : this, function () { /* ... */ });
```

## Modules

| File | Global | Role | Pure? |
| --- | --- | --- | --- |
| `src/csv.js` | `StockcueCsv` | RFC-4180-ish parser + CSV exporter | yes |
| `src/calc.js` | `StockcueCalc` | all reorder math and urgency classification | yes |
| `src/samples.js` | `StockcueSamples` | deterministic built-in sample shop | yes |
| `src/render.js` | `StockcueRender` | HTML string builders for table/summary | string-only (no DOM reads) |
| `src/app.js` | (IIFE) | DOM wiring, FileReader import, Blob export | no (browser only) |

`calc.js`, `csv.js`, and `samples.js` never touch the DOM, so the Node test
runner exercises the exact same code the browser runs.

## Data flow

```
sales CSV ----parseWithHeader---> [{date, sku, qty}]
inventory CSV parseWithHeader---> [{sku, name, on_hand, lead_time_days, supplier}]
                                          |
                                          v
        calc.evaluateShop({inventory, sales, windowDates, reviewDays,
                           safetyMode, manualUnits, serviceLevel, leadOverrides})
                                          |
                                          v
        rows sorted by urgency rank, then SKU --> render.tableBodyHtml --> table
                                          |
                                          v (user clicks Export)
        rows filtered to critical+order --> csv.stringify --> Blob download
```

## Formulas

All rounding uses `Math.ceil` at the points documented below. Intermediate
math stays in floating point; display values are rounded to 2 decimals in the
row object (`avgDailyDemand`, `demandStddev`, `daysOfCover`) for stable
rendering, while ROP/safety/suggestion are integers.

### Window

The sales window is the set of distinct dates found in the (SKU-filtered)
sales rows, or an explicit `windowDates` array. The UI passes the global
distinct-date set of *all* sales so every SKU is measured against the same
calendar. Days in the window with no rows for a SKU count as 0 demand.

### Average daily demand

```
avg_daily_demand = total qty sold in window / number of distinct days in window
```

0 when the window has no days or the SKU has no sales.

### Demand standard deviation

```
daily_demand_series = [qty sold on day_1, qty sold on day_2, ...]  (zero-filled)
demand_stddev = population standard deviation of daily_demand_series
              = sqrt( sum((x_i - mean)^2) / n )
```

Zero-demand days are included in the series (this widens the safety stock for
spiky sellers, which is the point). Empty series -> 0.

### Safety stock

Manual mode (default): `safety_stock_units = ceil(manual_units)` (user enters a
flat unit count; default 10).

Auto mode:

```
safety_stock_units = ceil(z * demand_stddev * sqrt(lead_time_days))
```

Service-level z table (hardcoded, the only three options in the UI):

| Service level | z |
| --- | --- |
| 90% | 1.28 |
| 95% | 1.65 |
| 99% | 2.33 |

### Reorder point

```
reorder_point = ceil(avg_daily_demand * lead_time_days + safety_stock_units)
```

### Suggested order quantity

```
suggested_order_qty = max(0,
  ceil(avg_daily_demand * (lead_time_days + review_days)
       + safety_stock_units - on_hand))
```

`review_days` is how often the shop owner places orders (default 7). It pads
the horizon so the order covers demand until the *next* review, not just until
this replenishment lands.

### Days of cover

```
days_of_cover = on_hand / avg_daily_demand
```

When `avg_daily_demand == 0`, days of cover is `Infinity`; the UI prints
`inf`.

### Zero-demand rule

If `avg_daily_demand == 0` the SKU is classified `no-demand`, the suggested
order quantity is forced to 0, and the why-text explains "no sales in window".
This holds even when on-hand is 0 - we will not invent demand from nothing;
the shop owner can raise a manual PO outside stockcue.

### Urgency classification (evaluated in this order)

| Status | Condition |
| --- | --- |
| `critical` | `on_hand < safety_stock_units` (stock has eaten into the buffer) |
| `order` | `on_hand <= reorder_point` (at or below the reorder point) |
| `watch` | `on_hand <= reorder_point * 1.25` (approaching the point) |
| `ok` | anything else |
| `no-demand` | `avg_daily_demand == 0` (checked first, overrides the rest) |

Note the boundary choices: `on_hand == reorder_point` is `order`;
`on_hand == safety_stock` is *not* critical (equality is allowed to sit at the
buffer floor); `on_hand == reorder_point * 1.25` is `watch`.

### Sorting

Rows sort by urgency rank (`critical` < `order` < `watch` < `ok` <
`no-demand`), ties broken by SKU ascending. The export keeps this order.

### Why-text

Each row carries a plain-language sentence computed from its own numbers, e.g.
`2.32 days cover <= 16-day lead + 4.65 safety days (ROP 45).` Safety stock is
converted to days (`safety_stock / avg_daily_demand`) so the sentence compares
like with like. The numbers in the sentence are the same values shown in the
table - no hidden math.

## CSV dialect

`csv.parse` implements RFC-4180-ish parsing by hand:

- quoted fields, `""` for a literal quote, commas and newlines inside quotes
- CRLF, LF, or lone-CR row separators; optional trailing newline
- blank lines skipped by `parseWithHeader`; rows must match the header width
- malformed input throws a `CsvError` (with a line number when known); the UI
  catches it and shows the message in the status line - no crash

`csv.stringify` emits CRLF-separated rows with RFC quoting, and is used both
by the browser export (Blob download) and by the Node artifact generator.

## Sample shop determinism

`src/samples.js` contains a fixed-seed LCG (`seed = 20261012`, Numerical
Recipes constants). No `Math.random()` anywhere. The 12 SKUs, their base
demand, and the 72-day window (2026-07-01 .. 2026-09-10) are constants.
Tests assert two successive calls produce identical arrays, and that
`examples/*.csv` (generated once by `tools/generate-artifacts.cjs`) still
match the generator byte-for-value. CI re-runs the generator and fails if any
committed artifact drifts.

## file:// compatibility

- no `fetch`, no XHR, no ES modules, no import maps, no service worker
- file inputs use `FileReader` (works on `file://`); export uses `Blob` +
  `URL.createObjectURL`
- styles are a single local stylesheet; fonts are the system font stack
- scripts are loaded in dependency order: csv, calc, samples, render, app
