"use strict";

const test = require("node:test");
const assert = require("node:assert");
const calc = require("../src/calc.js");

test("calc: avgDailyDemand divides total by distinct days", () => {
  const sales = [
    { date: "2026-01-01", sku: "A", qty: 3 },
    { date: "2026-01-02", sku: "A", qty: 7 }
  ];
  // 10 units over 2 distinct days = 5
  assert.strictEqual(calc.avgDailyDemand(sales), 5);
});

test("calc: avgDailyDemand uses explicit window length", () => {
  const sales = [{ date: "2026-01-01", sku: "A", qty: 10 }];
  // 10 units over a 5-day window = 2
  assert.strictEqual(
    calc.avgDailyDemand(sales, ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"]),
    2
  );
});

test("calc: avgDailyDemand is 0 with no sales", () => {
  assert.strictEqual(calc.avgDailyDemand([]), 0);
});

test("calc: populationStdDev of a known series", () => {
  // classic example: mean 5, population stddev 2
  assert.strictEqual(calc.populationStdDev([2, 4, 4, 4, 5, 5, 7, 9]), 2);
});

test("calc: populationStdDev of empty series is 0", () => {
  assert.strictEqual(calc.populationStdDev([]), 0);
});

test("calc: dailyDemandSeries fills zero-demand days", () => {
  const sales = [
    { date: "2026-01-01", sku: "A", qty: 3 },
    { date: "2026-01-01", sku: "A", qty: 2 },
    { date: "2026-01-03", sku: "A", qty: 4 }
  ];
  const series = calc.dailyDemandSeries(sales, ["2026-01-01", "2026-01-02", "2026-01-03"]);
  assert.deepStrictEqual(series, [5, 0, 4]);
});

test("calc: demandStdDev fills zero days before computing", () => {
  const sales = [
    { date: "2026-01-01", sku: "A", qty: 4 },
    { date: "2026-01-03", sku: "A", qty: 4 }
  ];
  const sd = calc.demandStdDev(sales, ["2026-01-01", "2026-01-02", "2026-01-03"]);
  // series [4,0,4]: mean 8/3, stddev = sqrt(((4-m)^2*2 + m^2)/3)
  const m = 8 / 3;
  const expected = Math.sqrt((2 * (4 - m) * (4 - m) + m * m) / 3);
  assert.ok(Math.abs(sd - expected) < 1e-9);
});

test("calc: manual safety stock rounds up with Math.ceil", () => {
  assert.strictEqual(calc.computeSafetyStock({ mode: "manual", manualUnits: 7.2 }), 8);
  assert.strictEqual(calc.computeSafetyStock({ mode: "manual", manualUnits: 10 }), 10);
  assert.strictEqual(calc.computeSafetyStock({ mode: "manual", manualUnits: -5 }), 0);
});

test("calc: auto safety stock uses z * stddev * sqrt(lead), ceil", () => {
  // 1.65 * 4 * sqrt(9) = 19.8 -> 20
  assert.strictEqual(
    calc.computeSafetyStock({ mode: "auto", z: 1.65, demandStddev: 4, leadTimeDays: 9 }),
    20
  );
});

test("calc: z-table maps service levels", () => {
  assert.strictEqual(calc.zForServiceLevel("90"), 1.28);
  assert.strictEqual(calc.zForServiceLevel("95"), 1.65);
  assert.strictEqual(calc.zForServiceLevel(99), 2.33);
  assert.strictEqual(calc.zForServiceLevel("95%"), 1.65);
  assert.throws(() => calc.zForServiceLevel("75"));
});

test("calc: reorder point uses ceil of avg*lead + safety", () => {
  // 2.5 * 7 + 10 = 27.5 -> 28
  assert.strictEqual(calc.reorderPoint(2.5, 7, 10), 28);
});

test("calc: reorder point keeps exact integers exact", () => {
  assert.strictEqual(calc.reorderPoint(3, 10, 5), 35);
});

test("calc: suggested order qty covers demand over lead+review", () => {
  // avg 4 * (7+7) + 10 - 50 = 56 + 10 - 50 = 16
  assert.strictEqual(calc.suggestedOrderQty(4, 7, 7, 10, 50), 16);
});

test("calc: suggested order qty clamps at zero", () => {
  assert.strictEqual(calc.suggestedOrderQty(1, 5, 5, 10, 500), 0);
  // exact-zero boundary: equals target, nothing to order
  assert.strictEqual(calc.suggestedOrderQty(2, 10, 0, 10, 30), 0);
});

test("calc: daysOfCover is Infinity when demand is 0", () => {
  assert.strictEqual(calc.daysOfCover(50, 0), Infinity);
  assert.strictEqual(calc.daysOfCover(50, 5), 10);
});

test("calc: urgency critical when on_hand below safety stock", () => {
  assert.strictEqual(
    calc.classifyUrgency({ onHand: 4, safetyStock: 10, reorderPoint: 50, avgDailyDemand: 4 }),
    "critical"
  );
});

test("calc: urgency order at boundary on_hand == reorder_point", () => {
  assert.strictEqual(
    calc.classifyUrgency({ onHand: 50, safetyStock: 10, reorderPoint: 50, avgDailyDemand: 4 }),
    "order"
  );
});

test("calc: urgency watch just above reorder point", () => {
  // ROP 50, watch band up to 62.5
  assert.strictEqual(
    calc.classifyUrgency({ onHand: 62, safetyStock: 10, reorderPoint: 50, avgDailyDemand: 4 }),
    "watch"
  );
});

test("calc: urgency ok above the 125% watch band", () => {
  assert.strictEqual(
    calc.classifyUrgency({ onHand: 80, safetyStock: 10, reorderPoint: 50, avgDailyDemand: 4 }),
    "ok"
  );
});

test("calc: urgency no-demand when average demand is zero", () => {
  assert.strictEqual(
    calc.classifyUrgency({ onHand: 48, safetyStock: 10, reorderPoint: 10, avgDailyDemand: 0 }),
    "no-demand"
  );
});

test("calc: evaluateSku zero-demand SKU suggests 0 and explains why", () => {
  const row = calc.evaluateSku(
    { sku: "X", name: "Thing", onHand: 48, leadTimeDays: 10, supplier: "S" },
    { salesRows: [], windowDates: ["2026-01-01", "2026-01-02"], reviewDays: 7, safetyMode: "manual", manualUnits: 10 }
  );
  assert.strictEqual(row.urgency, "no-demand");
  assert.strictEqual(row.suggestedQty, 0);
  assert.match(row.why, /no sales/i);
});

test("calc: evaluateSku manual safety stock reaches ROP and suggestion", () => {
  // avg 4/day, lead 10, safety 10 -> ROP = 4*10+10 = 50; on hand 30 -> order
  // suggest = 4*(10+7)+10-30 = 68+10-30 = 48
  const row = calc.evaluateSku(
    { sku: "Y", name: "Thing", onHand: 30, leadTimeDays: 10, supplier: "S" },
    {
      salesRows: [
        { date: "2026-01-01", sku: "Y", qty: 4 },
        { date: "2026-01-02", sku: "Y", qty: 4 },
        { date: "2026-01-03", sku: "Y", qty: 4 }
      ],
      windowDates: ["2026-01-01", "2026-01-02", "2026-01-03"],
      reviewDays: 7,
      safetyMode: "manual",
      manualUnits: 10
    }
  );
  assert.strictEqual(row.avgDailyDemand, 4);
  assert.strictEqual(row.safetyStock, 10);
  assert.strictEqual(row.reorderPoint, 50);
  assert.strictEqual(row.suggestedQty, 48);
  assert.strictEqual(row.urgency, "order");
});

test("calc: evaluateSku auto safety stock uses demand stddev", () => {
  // series [4,0,4] -> stddev ~1.8856; z=1.65, lead=9
  // auto safety = ceil(1.65 * 1.8856 * 3) = ceil(9.33) = 10
  const row = calc.evaluateSku(
    { sku: "Z", name: "Thing", onHand: 0, leadTimeDays: 9, supplier: "S" },
    {
      salesRows: [
        { date: "2026-01-01", sku: "Z", qty: 4 },
        { date: "2026-01-03", sku: "Z", qty: 4 }
      ],
      windowDates: ["2026-01-01", "2026-01-02", "2026-01-03"],
      reviewDays: 0,
      safetyMode: "auto",
      serviceLevel: "95"
    }
  );
  assert.strictEqual(row.safetyMode, "auto");
  assert.strictEqual(row.safetyStock, 10);
  assert.strictEqual(row.urgency, "critical");
});

test("calc: evaluateShop sorts by urgency rank then SKU", () => {
  const rows = calc.evaluateShop({
    inventory: [
      { sku: "B-OK", name: "b", onHand: 1000, leadTimeDays: 1, supplier: "S" },
      { sku: "A-CRIT", name: "a", onHand: 0, leadTimeDays: 10, supplier: "S" },
      { sku: "A-OK", name: "c", onHand: 2000, leadTimeDays: 1, supplier: "S" },
      { sku: "B-CRIT", name: "d", onHand: 0, leadTimeDays: 10, supplier: "S" }
    ],
    sales: [
      { date: "2026-01-01", sku: "A-CRIT", qty: 5 },
      { date: "2026-01-01", sku: "B-CRIT", qty: 5 },
      { date: "2026-01-01", sku: "B-OK", qty: 5 },
      { date: "2026-01-01", sku: "A-OK", qty: 5 }
    ],
    reviewDays: 0,
    safetyMode: "manual",
    manualUnits: 10
  });
  assert.deepStrictEqual(
    rows.map((r) => r.sku),
    ["A-CRIT", "B-CRIT", "A-OK", "B-OK"]
  );
});

test("calc: evaluateShop honors per-SKU lead overrides", () => {
  const base = {
    inventory: [{ sku: "A", name: "a", onHand: 30, leadTimeDays: 10, supplier: "S" }],
    sales: [
      { date: "2026-01-01", sku: "A", qty: 4 },
      { date: "2026-01-02", sku: "A", qty: 4 },
      { date: "2026-01-03", sku: "A", qty: 4 }
    ],
    reviewDays: 0,
    safetyMode: "manual",
    manualUnits: 0
  };
  const without = calc.evaluateShop(base)[0];
  assert.strictEqual(without.reorderPoint, 40); // 4*10
  const withOverride = calc.evaluateShop({ ...base, leadOverrides: { A: 5 } })[0];
  assert.strictEqual(withOverride.reorderPoint, 20); // 4*5
});

test("calc: summarize counts every urgency bucket", () => {
  const counts = calc.summarize([
    { urgency: "critical" },
    { urgency: "critical" },
    { urgency: "order" },
    { urgency: "watch" },
    { urgency: "ok" },
    { urgency: "no-demand" }
  ]);
  assert.strictEqual(counts.total, 6);
  assert.deepStrictEqual(counts.counts, {
    critical: 2,
    order: 1,
    watch: 1,
    ok: 1,
    "no-demand": 1
  });
});
