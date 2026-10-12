# stockcue - usage guide

## Opening the app

Double-click `index.html`. That is the whole installation. stockcue runs
entirely inside your browser from your local disk; nothing is uploaded.

## First run - the sample shop

Click **Load sample shop**. You get 12 SKUs with 72 days of sales
(2026-07-01 to 2026-09-10) and current stock levels. Every control is live:
change a setting and the table recalculates immediately.

## Settings

| Control | What it does | Default |
| --- | --- | --- |
| Safety stock mode | `Manual`: you enter a flat buffer in units. `Auto`: buffer derived from how spiky your sales are (`z * stddev * sqrt(lead)`) | Manual |
| Manual safety stock (units) | The flat buffer used in manual mode. Raise it for items you cannot afford to run out of | 10 |
| Service level | Only used in Auto mode: 90% (z=1.28), 95% (z=1.65), 99% (z=2.33) | 95% |
| Review days | How often you place orders. The suggestion covers demand until your *next* review, not just until the truck arrives | 7 |

Per-SKU lead time can be edited directly in the table (the "Lead days" column).
Edits recalculate that row instantly and survive other setting changes until
you reload data.

## Reading the table

Rows are sorted worst-first. Each row shows on-hand stock, average daily
sales, lead time, safety stock, reorder point (ROP), suggested order
quantity, days of cover, an urgency badge, and a plain-language why:

- **Critical** - stock has dropped below the safety buffer. Order now.
- **Order** - stock is at or below the reorder point. Order in this cycle.
- **Watch** - stock is within 25% above the reorder point. Order soon.
- **OK** - comfortably above the reorder point.
- **No demand** - no sales in the window; stockcue will not invent an order.
  (Exception: it never suggests ordering for these; raise a manual PO if you
  know better than the data.)

The summary strip above the table shows counts per urgency and the sales
window dates.

## Importing your own data

Two CSV files, chosen with the file pickers, then **Import CSVs**.

Sales CSV - one row per line item sale:

```
date,sku,qty
2026-07-01,TEA-GREEN-100,6
2026-07-01,COFF-BEAN-250,11
2026-07-02,TEA-GREEN-100,9
```

- `date` must be `YYYY-MM-DD`.
- `sku` must match the inventory file.
- `qty` is units sold that day (non-negative number).
- Multiple rows for the same sku+date are summed automatically.

Inventory CSV - one row per product:

```
sku,name,on_hand,lead_time_days,supplier
TEA-GREEN-100,Green Tea 100g,55,10,Leaf & Co
COFF-BEAN-250,Coffee Beans 250g,30,7,Roast House
```

- `on_hand` is units currently on the shelf (non-negative number).
- `lead_time_days` is your supplier's typical lead time; editable later in
  the table.
- `supplier` is free text, carried into the export.

Quoted fields (commas inside names, `""` for a literal quote) are supported.
Malformed files produce a readable error in the status line; your current
data is kept. Sample files matching the built-in shop live in `examples/`.

Notes on the window: the sales window is the set of distinct dates across your
sales file. SKUs with no rows still appear (from inventory) with 0 average
demand. Inventory SKUs missing from sales are fine; sales SKUs missing from
inventory are ignored (stockcue needs on-hand to advise).

## Exporting the order list

Click **Export order list CSV**. stockcue downloads
`stockcue-order-list.csv` containing every SKU in critical or order status:

```
sku,name,action,suggested_qty,on_hand,lead_time_days,supplier,urgency
BOTT-STEEL-500,Steel Bottle 500ml,order,55,5,16,HydraMetal,critical
COFF-BEAN-250,Coffee Beans 250g,order,145,30,7,Roast House,order
```

Rows keep the urgency sort from the table. Attach it to a supplier email, or
paste the quantities into your purchasing sheet.

## What the numbers mean (short version)

- `avg/day` = total units sold in the window / days in the window.
- `ROP` = ceil(avg/day x lead days + safety stock). At or below this, reorder.
- `Suggest qty` = ceil(avg/day x (lead days + review days) + safety stock -
  on hand), floored at 0.
- `Days cover` = on hand / avg per day (`inf` when there are no sales).

Full formulas and boundary semantics: `docs/ARCHITECTURE.md`.

## Limitations to keep in mind

- No seasonality or trend detection - a 72-day average is just an average.
- One warehouse, one currency/unit system, CSV only.
- Suggested quantities ignore supplier minimums, case packs, and budgets.
- Advisory math, not financial advice.
