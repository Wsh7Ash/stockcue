# stockcue - results (0.1.0)

All output on this page was observed on the machine that built the project
(Windows win32, Node v24.13.0, PowerShell 7) on 2026-10-12. Nothing is
hand-written or estimated.

## Test run

Command (repo root):

```
node --test tests\
```

Observed summary (default reporter):

```
tests 65
suites 0
pass 65
fail 0
cancelled 0
skipped 0
todo 0
```

Exit code: **0**. (The default reporter marks each summary line with an
info glyph; the ASCII-clean TAP paste below is from the same run.)

ASCII-clean paste of the same suite via the TAP reporter
(`node --test --test-reporter=tap tests`, tail):

```
1..65
# tests 65
# suites 0
# pass 65
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 196.6716
```

Exit code: **0**.

The same 65/65 result was verified with `node --test` (bare discovery) and
`node --test "tests/*.test.cjs"`. (`tests/index.js` exists so that an explicit
directory argument works on Node 24, where directory args are executed rather
than globbed.)

Test breakdown by file:

- `tests/csv.test.cjs` - 18 cases: quotes, escaped quotes, commas in quotes,
  CRLF/CR/LF, trailing newline, empty fields, multi-line quoted fields,
  unterminated quote, quote-in-unquoted-field, header parsing, blank lines,
  column mismatch, empty file, escaping, round-trip.
- `tests/calc.test.cjs` - 26 cases: avg daily demand (incl. explicit window),
  population stddev, zero-filled daily series, manual/auto safety stock,
  z-table, reorder point ceil, exact-integer no-bump, suggestion quantity
  (positive + clamp-to-zero + exact boundary), days-of-cover Infinity, all
  five urgency branches (incl. `on_hand == reorder_point`), zero-demand SKU,
  lead overrides, sort order, summarize counts.
- `tests/samples.test.cjs` - 8 cases: generator determinism (deep-equal
  across calls), 12-SKU/72-day window shape, zero-demand SKU has no rows,
  row well-formedness, and two consistency tests asserting
  `examples/*.csv` match the built-in sample generator exactly.
- `tests/export.test.cjs` - 5 cases: export header shape, urgency sort
  preserved, parser round-trip, comma/quote escaping, auto-mode export.
- `tests/html.test.cjs` - 8 cases: classic script tags present, no
  `type="module"`, local stylesheet only, no fetch/XHR/import/export in any
  `src/` file, table row classes, HTML escaping of hostile strings, empty
  state, summary strip.

## Demo

**demo run: PASS (table computed via Node against sample data; page render
additionally verified in headless Chrome).**

Method actually used:

1. `node tools/generate-artifacts.cjs` - evaluates the built-in sample shop
   through the real `src/calc.js` + `src/samples.js` with default UI settings
   (manual safety stock 10, review 7 days, service level 95%) and writes
   `results/table-snapshot.txt`, `results/order-list.csv`, `results/demo.md`,
   and the `examples/*.csv` files.
2. `node tools/smoke.mjs` - launched the locally installed Chrome
   (`C:\Program Files\Google\Chrome\Application\chrome.exe`) headless over
   `file://`, clicked "Load sample shop" in a harness that loads the real
   `src/*.js` + `styles.css`, and asserted the rendered table. Observed
   output:

```
SMOKE PASS: SMOKE-OK:12 rows rendered, sample shop loaded, urgency table present
```

The browser smoke test verifies rendering; every number below comes from the
Node run of the same pure modules the browser executes.

### Computed reorder table (sample shop, default settings)

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

Spot checks against the formulas:

- BOTT-STEEL-500: avg 2.15 x lead 16 = 34.4; + 10 safety = 44.4 -> ROP 45.
  On hand 5 < 10 safety -> critical. Suggest = ceil(2.15 x 23 + 10 - 5) =
  ceil(54.45) = 55.
- TEA-HERB-050: zero sales rows in the window -> avg 0 -> no-demand, suggest
  forced to 0, cover `inf`.
- MUG-CER-WHT: on hand 40 > ROP 27, and 40 > ceil(27 x 1.25) = 34 -> ok.

### Exported order list (results/order-list.csv)

```
sku,name,action,suggested_qty,on_hand,lead_time_days,supplier,urgency
BOTT-STEEL-500,Steel Bottle 500ml,order,55,5,16,HydraMetal,critical
CAND-BSW-120,Beeswax Candle 120g,order,9,18,21,Wickery,order
COFF-BEAN-250,Coffee Beans 250g,order,145,30,7,Roast House,order
PEN-BALL-BLK,Ballpoint Pen Black,order,131,25,3,InkRight,order
SOAP-LAV-100,Lavender Soap 100g,order,60,12,12,CleanBar,order
SOCK-WOL-GRY,Wool Socks Grey,order,42,35,11,Knitwell,order
TEA-GREEN-100,Green Tea 100g,order,80,55,10,Leaf & Co,order
TOTE-CAN-NAT,Canvas Tote Natural,order,92,14,9,Stitchery,order
```

### Plain-language why-text (from results/demo.md)

| SKU | Urgency | Suggested | Why |
| --- | --- | --- | --- |
| BOTT-STEEL-500 | critical | 55 | 5 on hand is below the 10-unit safety stock (cover 2.32 days). |
| CAND-BSW-120 | order | 9 | 30.86 days cover <= 21-day lead + 17.24 safety days (ROP 23). |
| COFF-BEAN-250 | order | 145 | 2.55 days cover <= 7-day lead + 0.85 safety days (ROP 93). |
| PEN-BALL-BLK | order | 131 | 1.72 days cover <= 3-day lead + 0.69 safety days (ROP 54). |
| SOAP-LAV-100 | order | 60 | 3.69 days cover <= 12-day lead + 3.08 safety days (ROP 49). |
| SOCK-WOL-GRY | order | 42 | 9.51 days cover <= 11-day lead + 2.72 safety days (ROP 51). |
| TEA-GREEN-100 | order | 80 | 7.5 days cover <= 10-day lead + 1.36 safety days (ROP 84). |
| TOTE-CAN-NAT | order | 92 | 2.36 days cover <= 9-day lead + 1.68 safety days (ROP 64). |
| HONEY-WLD-250 | watch | 4 | 27.87 days cover <= 125% of ROP (62); order soon (ROP 49). |
| MUG-CER-WHT | ok | 0 | 33.1 days cover > 14-day lead + 8.26 safety days (ROP 27). |
| NOTE-A5-LIN | ok | 0 | 19.4 days cover > 5-day lead + 2.16 safety days (ROP 34). |
| TEA-HERB-050 | no-demand | 0 | No sales in window; suggestion stays 0. |

## Committed artifacts

| File | What it is |
| --- | --- |
| `results/table-snapshot.txt` | text rendering of the computed table (written by the generator) |
| `results/order-list.csv` | the 8-line export produced by the real export logic in Node |
| `results/demo.md` | full demo paste incl. per-SKU why-text |
| `examples/sales-sample.csv` | sample sales, importable; asserted equal to the built-in generator |
| `examples/inventory-sample.csv` | sample inventory, importable; asserted equal to the built-in generator |

CI (`.github/workflows/ci.yml`) re-runs `node --test tests` and
`node tools/generate-artifacts.cjs`, then `git diff --exit-code` on
`examples/` and `results/` so the committed demo can never silently drift
from the code.

## Deviations from the factory spec

- The spec's literal test command `node --test tests\` initially failed on
  Node 24.13 because explicit directory arguments are executed as entry
  points, not globbed. Fix: `tests/index.js` requires the five test files, so
  `node --test tests`, bare `node --test`, and the glob form all run the same
  65 tests. No other deviation.
- Demo used headless Chrome for a render smoke test via a temporary harness
  (the real index.html cannot auto-click its own button from the CLI); all
  computed numbers come from Node running the same pure modules.
