"use strict";

const test = require("node:test");
const assert = require("node:assert");
const calc = require("../src/calc.js");
const csv = require("../src/csv.js");
const samples = require("../src/samples.js");

const EXPORT_HEADERS = [
  "sku", "name", "action", "suggested_qty",
  "on_hand", "lead_time_days", "supplier", "urgency"
];

function buildExportRows(opts = {}) {
  const rows = calc.evaluateShop({
    inventory: samples.sampleInventory(),
    sales: samples.sampleSales(),
    windowDates: samples.sampleWindowDates(),
    reviewDays: opts.reviewDays ?? 7,
    safetyMode: opts.safetyMode ?? "manual",
    manualUnits: opts.manualUnits ?? 10,
    serviceLevel: opts.serviceLevel ?? "95"
  });
  const orderRows = rows.filter((r) => r.urgency === "critical" || r.urgency === "order");
  const grid = [EXPORT_HEADERS].concat(
    orderRows.map((r) => [
      r.sku, r.name, "order", r.suggestedQty, r.onHand, r.leadTimeDays, r.supplier, r.urgency
    ])
  );
  return { grid, orderRows };
}

test("export: header row matches the documented shape", () => {
  const { grid } = buildExportRows();
  assert.deepStrictEqual(grid[0], EXPORT_HEADERS);
  assert.ok(grid.length >= 2, "sample shop should export at least one order line");
});

test("export: exported lines keep urgency sort order from evaluateShop", () => {
  const { orderRows } = buildExportRows();
  const rank = { critical: 0, order: 1 };
  for (let i = 1; i < orderRows.length; i++) {
    assert.ok(
      rank[orderRows[i - 1].urgency] <= rank[orderRows[i].urgency],
      "export must stay urgency-sorted"
    );
    if (orderRows[i - 1].urgency === orderRows[i].urgency) {
      assert.ok(orderRows[i - 1].sku <= orderRows[i].sku, "ties broken by sku");
    }
  }
});

test("export: exported text round-trips through the parser", () => {
  const { grid } = buildExportRows();
  const text = csv.stringify(grid);
  assert.ok(text.endsWith("\r\n"), "trailing CRLF");
  const back = csv.parse(text);
  assert.deepStrictEqual(back, grid.map((r) => r.map(String)));
});

test("export: names containing commas and quotes are escaped", () => {
  const grid = [
    EXPORT_HEADERS,
    ["X-1", 'Deluxe, "gold" mug', "order", 5, 1, 3, "Acme, Inc.", "order"]
  ];
  const text = csv.stringify(grid);
  const back = csv.parse(text);
  assert.strictEqual(back[1][1], 'Deluxe, "gold" mug');
  assert.strictEqual(back[1][6], "Acme, Inc.");
});

test("export: auto-mode sample shop also produces a valid export", () => {
  const { grid } = buildExportRows({ safetyMode: "auto", serviceLevel: "99" });
  assert.deepStrictEqual(csv.parse(csv.stringify(grid)), grid.map((r) => r.map(String)));
});
