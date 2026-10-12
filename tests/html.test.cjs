"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const render = require("../src/render.js");

const root = path.join(__dirname, "..");

test("html: index.html loads every script as a classic script", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  for (const src of ["src/csv.js", "src/calc.js", "src/samples.js", "src/render.js", "src/app.js"]) {
    assert.ok(html.includes('<script src="' + src + '">'), "missing script tag: " + src);
  }
});

test("html: index.html uses no ES modules and no fetch", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(!html.includes('type="module"'), "must stay classic-script compatible");
  assert.ok(!/src\s*=\s*"https?:/.test(html), "no remote scripts");
  assert.ok(!html.includes("fetch("), "no fetch in page");
});

test("html: index.html links the local stylesheet only", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(html.includes('<link rel="stylesheet" href="styles.css">'));
  assert.ok(!html.includes("http://") && !html.includes("https://"), "no external URLs");
});

test("html: source modules never use fetch, XHR, or ES module syntax", () => {
  for (const f of ["csv.js", "calc.js", "samples.js", "render.js", "app.js"]) {
    const code = fs.readFileSync(path.join(root, "src", f), "utf8");
    assert.ok(!/\bfetch\s*\(/.test(code), f + " must not call fetch");
    assert.ok(!/XMLHttpRequest/.test(code), f + " must not use XHR");
    assert.ok(!/^\s*import\s/m.test(code), f + " must not use import statements");
    assert.ok(!/^\s*export\s/m.test(code), f + " must not use export statements");
  }
});

test("render: tableBodyHtml renders one row per SKU with urgency class", () => {
  const rows = [
    {
      sku: "A-1", name: "Thing", onHand: 5, avgDailyDemand: 2.5, leadTimeDays: 10,
      safetyStock: 10, reorderPoint: 35, suggestedQty: 40, daysOfCover: 2,
      urgency: "order", why: "2 days cover <= 10-day lead + 10 safety (ROP 35)."
    }
  ];
  const html = render.tableBodyHtml(rows);
  assert.ok(html.includes('class="urgency-order"'));
  assert.ok(html.includes('data-sku="A-1"'));
  assert.ok(html.includes(">40</td>"));
  assert.ok(html.includes("days cover"));
});

test("render: tableBodyHtml escapes HTML in names and why text", () => {
  const rows = [
    {
      sku: "A-1", name: '<script>alert(1)</script>', onHand: 0, avgDailyDemand: 1,
      leadTimeDays: 1, safetyStock: 5, reorderPoint: 6, suggestedQty: 7,
      daysOfCover: 0, urgency: "critical", why: '5 < 10 & "more"'
    }
  ];
  const html = render.tableBodyHtml(rows);
  assert.ok(!html.includes("<script>alert"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&quot;more&quot;"));
});

test("render: empty rows produce a friendly empty state", () => {
  const html = render.tableBodyHtml([]);
  assert.ok(html.includes("No SKUs to show"));
});

test("render: summaryHtml reports counts and the sales window", () => {
  const html = render.summaryHtml(
    { total: 12, counts: { critical: 1, order: 2, watch: 3, ok: 5, "no-demand": 1 } },
    ["2026-07-01", "2026-07-02", "2026-07-03"]
  );
  assert.ok(html.includes("12"));
  assert.ok(html.includes("2026-07-01 to 2026-07-03"));
  assert.ok(html.includes("critical"));
});
