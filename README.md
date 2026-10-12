# stockcue

**An offline reorder-point advisor for small shops: load your sales history
and stock levels, and instantly see which SKUs need reordering, how many to
order, and why - entirely in your browser, data never leaves the machine.**

## The problem

Small shops reorder by gut feel or by squinting at a spreadsheet column of
"current stock". That ignores how sales velocity, supplier lead time, and the
safety buffer interact - so you either tie up cash in over-ordering or lose
sales to stockouts. The tools that do this math properly want an account, a
subscription, and a copy of your sales data in their cloud.

## Features

- Reorder point, suggested order quantity, and days of cover for every SKU,
  using your lead times and review cadence.
- Manual safety stock (flat units) or auto safety stock from demand
  variability, with a 90/95/99% service-level selector.
- Urgency ranking - critical / order / watch / OK / no-demand - with a
  plain-language "why" on every row (e.g. `2.32 days cover <= 16-day lead +
  4.65 safety days (ROP 45).`).
- Inline editable lead time per SKU, recalculating live.
- Built-in deterministic sample shop (12 SKUs, 72 days) for instant trial.
- CSV import for sales (`date,sku,qty`) and inventory
  (`sku,name,on_hand,lead_time_days,supplier`), CSV export of the order list.
- Works by double-clicking `index.html` over `file://`. No install, no
  build step, no network, no dependencies.

## Representative output

The built-in sample shop with default settings (manual safety stock 10 units,
review 7 days), computed by `tools/generate-artifacts.cjs` and committed in
`results/table-snapshot.txt`:

```
SKU            | Name                     | OnHand | Avg/Day | Lead | Safety |   ROP | Suggest |  Cover | Urgency
---------------+--------------------------+--------+---------+------+--------+-------+---------+--------+-----------
BOTT-STEEL-500 | Steel Bottle 500ml       |      5 |    2.15 |   16 |     10 |    45 |      55 |   2.32 | critical
CAND-BSW-120   | Beeswax Candle 120g      |     18 |    0.58 |   21 |     10 |    23 |       9 |  30.86 | order
COFF-BEAN-250  | Coffee Beans 250g        |     30 |   11.76 |    7 |     10 |    93 |     145 |   2.55 | order
PEN-BALL-BLK   | Ballpoint Pen Black      |     25 |   14.57 |    3 |     10 |    54 |     131 |   1.72 | order
SOAP-LAV-100   | Lavender Soap 100g       |     12 |    3.25 |   12 |     10 |    49 |      60 |   3.69 | order
SOCK-WOL-GRY   | Wool Socks Grey          |     35 |    3.68 |   11 |     10 |    51 |      42 |   9.51 | order
TEA-GREEN-100  | Green Tea 100g           |     55 |    7.33 |   10 |     10 |    84 |      80 |    7.5 | order
TOTE-CAN-NAT   | Canvas Tote Natural      |     14 |    5.94 |    9 |     10 |    64 |      92 |   2.36 | order
HONEY-WLD-250  | Wildflower Honey 250g    |     60 |    2.15 |   18 |     10 |    49 |       4 |  27.87 | watch
MUG-CER-WHT    | Ceramic Mug White        |     40 |    1.21 |   14 |     10 |    27 |       0 |   33.1 | ok
NOTE-A5-LIN    | A5 Lined Notebook        |     90 |    4.64 |    5 |     10 |    34 |       0 |   19.4 | ok
TEA-HERB-050   | Herbal Tea Sampler 50g   |     48 |       0 |   10 |     10 |    10 |       0 |    inf | no-demand

Totals: 12 SKUs | 1 critical | 7 order | 1 watch | 2 ok | 1 no-demand
Window: 2026-07-01 + 72 days (through 2026-09-10)
Settings: safety=manual(10 units), review=7 days
```

The matching export (`results/order-list.csv`) contains the 8 critical+order
lines, ready to send to a supplier.

## The math

```
avg_daily_demand   = total qty sold / distinct days in window (0 if no sales)
demand_stddev      = population stddev of the daily demand series, zero-filled
safety_stock       = manual units                     (manual mode)
                   = ceil(z * demand_stddev * sqrt(lead_time_days))  (auto mode)
                       z: 90% -> 1.28, 95% -> 1.65, 99% -> 2.33
reorder_point      = ceil(avg_daily_demand * lead_time_days + safety_stock)
suggested_qty      = max(0, ceil(avg_daily_demand * (lead_time_days + review_days)
                                 + safety_stock - on_hand))
days_of_cover      = on_hand / avg_daily_demand   (inf when demand is 0)
```

Urgency, in order: `no-demand` when avg demand is 0 (suggestion forced to 0);
else `critical` if `on_hand < safety_stock`; `order` if
`on_hand <= reorder_point`; `watch` if `on_hand <= reorder_point * 1.25`;
else `ok`. Full derivations and boundary notes: `docs/ARCHITECTURE.md`.

## Architecture

Pure logic in three UMD-wrapped modules that run identically in the browser
and in Node tests - `src/calc.js` (all math), `src/csv.js` (hand-written
RFC-4180-ish parser/exporter), `src/samples.js` (fixed-seed sample shop, no
`Math.random()`). A thin DOM layer (`src/render.js` builds HTML strings,
`src/app.js` wires controls, FileReader import, Blob export) sits on top.
`index.html` loads them as classic `<script src>` tags in order. No ES
modules, no fetch, no CDN - it works from `file://`.

## Requirements

- Any modern browser (Chrome, Edge, Firefox, Safari) to use the app.
- Node 24+ only to run the test suite (nothing to install - no package.json,
  no dependencies).

## Installation

None. Clone or download the repo and double-click `index.html`.

## Quick start

1. Double-click `index.html`.
2. Click **Load sample shop** and look around - or pick your sales and
   inventory CSVs and click **Import CSVs**.
3. Read the table worst-first, adjust settings if you like, then click
   **Export order list CSV**.

## Usage examples

Sales CSV (`date,sku,qty`):

```
date,sku,qty
2026-07-01,TEA-GREEN-100,6
2026-07-01,COFF-BEAN-250,11
2026-07-02,TEA-GREEN-100,9
```

Inventory CSV (`sku,name,on_hand,lead_time_days,supplier`):

```
sku,name,on_hand,lead_time_days,supplier
TEA-GREEN-100,Green Tea 100g,55,10,Leaf & Co
COFF-BEAN-250,Coffee Beans 250g,30,7,Roast House
```

Matching sample files: `examples/sales-sample.csv`,
`examples/inventory-sample.csv` (identical to the built-in shop; a test
enforces this). More detail: `docs/USAGE.md`.

## Configuration

The Settings panel: safety-stock mode (manual/auto), manual safety units,
service level (auto mode only), and review days. Per-SKU lead times are
editable inline in the table. Nothing else is persisted - refresh the page
and you start clean (by design: no storage, no cloud).

## Testing

```
node --test tests
```

65 test cases across CSV parsing, reorder math, urgency branches, sample
determinism, example-consistency, export shape, and HTML sanity. Exit code 0
is the pass signal. Optional real-browser smoke test (requires local
Chrome/Edge): `node tools/smoke.mjs`.

## Project structure

```
index.html            the app (double-click entry point)
styles.css            local styles, system fonts only
src/csv.js            CSV parser + exporter (pure)
src/calc.js           reorder math (pure)
src/samples.js        deterministic sample shop (pure)
src/render.js         HTML string builders
src/app.js            DOM wiring, import/export
tests/                node --test suite (no dependencies)
docs/                 PROJECT_SPEC, ARCHITECTURE, USAGE
examples/             importable sample CSVs (match the built-in shop)
results/              committed demo artifacts (table, order list, demo.md)
tools/                artifact generator + optional Chrome smoke test
```

## Limitations

- Heuristic reorder math: a flat average over the window. No seasonality, no
  trend detection, no promotions awareness.
- Single warehouse, single unit/currency system (stockcue is unit-agnostic).
- CSV only; JSON/databases/spreadsheet plugins are roadmap, not today.
- Suggested quantities ignore supplier minimums, case packs, and budgets.
- Advisory decision support - not financial or purchasing advice.

## Roadmap

- JSON import alongside CSV.
- Multi-location stock (per-warehouse on-hand).
- Export a purchase order as PDF.
- Persist settings locally (opt-in, still offline).

## Security

stockcue is local-only by design: no network calls, no telemetry, no cookies,
CSVs parsed client-side only. See `SECURITY.md`.

## License

MIT - see `LICENSE`. Copyright (c) 2026 Wsh7Ash.
