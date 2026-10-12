"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const samples = require("../src/samples.js");
const csv = require("../src/csv.js");

test("samples: sales are deterministic across calls", () => {
  assert.deepStrictEqual(samples.sampleSales(), samples.sampleSales());
});

test("samples: inventory is deterministic across calls", () => {
  assert.deepStrictEqual(samples.sampleInventory(), samples.sampleInventory());
});

test("samples: shop shape is 12 SKUs and a 60-90 day window", () => {
  const inv = samples.sampleInventory();
  const dates = samples.sampleWindowDates();
  assert.strictEqual(inv.length, 12);
  assert.ok(dates.length >= 60 && dates.length <= 90, "window days=" + dates.length);
  assert.strictEqual(dates.length, 72);
  assert.strictEqual(new Set(dates).size, 72);
  assert.deepStrictEqual(
    [dates[0], dates[dates.length - 1]],
    ["2026-07-01", "2026-09-10"]
  );
});

test("samples: sales rows exist for every selling SKU on many days", () => {
  const sales = samples.sampleSales();
  const skus = new Set(sales.map((r) => r.sku));
  assert.strictEqual(skus.size, 11, "11 of 12 SKUs sell (one is zero-demand)");
  assert.ok(sales.length > 300, "rows=" + sales.length);
});

test("samples: zero-demand SKU has no sales rows", () => {
  const sales = samples.sampleSales();
  assert.ok(sales.length > 0, "sample sales should not be empty");
  assert.ok(
    sales.every((r) => r.sku !== "TEA-HERB-050"),
    "TEA-HERB-050 must have zero sales"
  );
});

test("samples: every sales row is well-formed and inside the window", () => {
  const dates = new Set(samples.sampleWindowDates());
  const sales = samples.sampleSales();
  for (const row of sales) {
    assert.match(row.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(dates.has(row.date), "date outside window: " + row.date);
    assert.ok(Number.isInteger(row.qty) && row.qty > 0, "bad qty");
    assert.ok(typeof row.sku === "string" && row.sku.length > 0);
  }
});

test("examples: sales-sample.csv matches built-in sample sales", () => {
  const text = fs.readFileSync(
    path.join(__dirname, "..", "examples", "sales-sample.csv"),
    "utf8"
  );
  const parsed = csv.parseWithHeader(text);
  assert.deepStrictEqual(parsed.headers, ["date", "sku", "qty"]);
  const fromCsv = parsed.rows.map((r) => ({
    date: r.date,
    sku: r.sku,
    qty: parseFloat(r.qty)
  }));
  assert.deepStrictEqual(fromCsv, samples.sampleSales());
});

test("examples: inventory-sample.csv matches built-in sample inventory", () => {
  const text = fs.readFileSync(
    path.join(__dirname, "..", "examples", "inventory-sample.csv"),
    "utf8"
  );
  const parsed = csv.parseWithHeader(text);
  assert.deepStrictEqual(parsed.headers, ["sku", "name", "on_hand", "lead_time_days", "supplier"]);
  const fromCsv = parsed.rows.map((r) => ({
    sku: r.sku,
    name: r.name,
    onHand: parseFloat(r.on_hand),
    leadTimeDays: parseFloat(r.lead_time_days),
    supplier: r.supplier
  }));
  assert.deepStrictEqual(fromCsv, samples.sampleInventory());
});
