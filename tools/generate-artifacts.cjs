"use strict";

// One-time generator for committed artifacts:
//   examples/sales-sample.csv, examples/inventory-sample.csv,
//   results/order-list.csv, results/table-snapshot.txt, results/demo.md
// Run from repo root: node tools/generate-artifacts.cjs

const fs = require("node:fs");
const path = require("node:path");
const samples = require("../src/samples.js");
const csv = require("../src/csv.js");
const calc = require("../src/calc.js");

const root = path.join(__dirname, "..");

function write(rel, text) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text, "utf8");
  console.log("wrote", rel, "(" + text.length + " bytes)");
}

// --- examples (must match built-in sample data) ---
write("examples/sales-sample.csv", csv.stringify(samples.salesCsvRows()));
write("examples/inventory-sample.csv", csv.stringify(samples.inventoryCsvRows()));

// --- compute shop with default UI settings ---
const rows = calc.evaluateShop({
  inventory: samples.sampleInventory(),
  sales: samples.sampleSales(),
  windowDates: samples.sampleWindowDates(),
  reviewDays: 7,
  safetyMode: "manual",
  manualUnits: 10,
  serviceLevel: "95"
});

// --- results/order-list.csv ---
const EXPORT_HEADERS = [
  "sku", "name", "action", "suggested_qty",
  "on_hand", "lead_time_days", "supplier", "urgency"
];
const orderRows = rows.filter((r) => r.urgency === "critical" || r.urgency === "order");
write(
  "results/order-list.csv",
  csv.stringify(
    [EXPORT_HEADERS].concat(
      orderRows.map((r) => [
        r.sku, r.name, "order", r.suggestedQty, r.onHand, r.leadTimeDays, r.supplier, r.urgency
      ])
    )
  )
);

// --- results/table-snapshot.txt ---
function fmt(v) {
  if (v === Infinity) return "inf";
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 100) / 100);
}
function pad(s, w, right) {
  s = String(s);
  if (s.length >= w) return s;
  return right ? s.padStart(w) : s.padEnd(w);
}

const cols = [
  ["SKU", 14, false, (r) => r.sku],
  ["Name", 24, false, (r) => r.name],
  ["OnHand", 6, true, (r) => fmt(r.onHand)],
  ["Avg/Day", 7, true, (r) => fmt(r.avgDailyDemand)],
  ["Lead", 4, true, (r) => fmt(r.leadTimeDays)],
  ["Safety", 6, true, (r) => fmt(r.safetyStock)],
  ["ROP", 5, true, (r) => fmt(r.reorderPoint)],
  ["Suggest", 7, true, (r) => fmt(r.suggestedQty)],
  ["Cover", 6, true, (r) => fmt(r.daysOfCover)],
  ["Urgency", 10, false, (r) => r.urgency]
];

const header = cols.map((c) => pad(c[0], c[1], c[2])).join(" | ");
const sep = cols.map((c) => "-".repeat(c[1])).join("-+-");
const body = rows.map((r) => cols.map((c) => pad(c[3](r), c[1], c[2])).join(" | ")).join("\n");
const summary = calc.summarize(rows);
const summaryLine =
  "\nTotals: " + summary.total + " SKUs | " +
  summary.counts.critical + " critical | " +
  summary.counts.order + " order | " +
  summary.counts.watch + " watch | " +
  summary.counts.ok + " ok | " +
  summary.counts["no-demand"] + " no-demand\n" +
  "Window: " + samples.WINDOW_START + " + " + samples.WINDOW_DAYS + " days (through 2026-09-10)\n" +
  "Settings: safety=manual(10 units), review=7 days\n";

const snapshot = header + "\n" + sep + "\n" + body + "\n" + summaryLine;
write("results/table-snapshot.txt", snapshot + "\n");

// --- results/demo.md ---
const md = [
  "# stockcue demo (computed, not hand-written)",
  "",
  "Produced by `node tools/generate-artifacts.cjs` against the built-in sample",
  "shop using default UI settings: manual safety stock 10 units, review 7 days,",
  "service level 95% (unused in manual mode).",
  "",
  "## Reorder table (urgency-sorted)",
  "",
  "```",
  snapshot,
  "```",
  "",
  "## Plain-language explanations (per SKU)",
  "",
  "| SKU | Urgency | Suggested | Why |",
  "| --- | --- | --- | --- |"
].concat(
  rows.map((r) => "| " + r.sku + " | " + r.urgency + " | " + fmt(r.suggestedQty) + " | " + r.why + " |")
).concat(["", "## Exported order list", "", "See `results/order-list.csv` (" + orderRows.length + " line(s)).", ""]);
write("results/demo.md", md.join("\n"));

console.log("done:", rows.length, "SKUs evaluated,", orderRows.length, "order lines exported");
