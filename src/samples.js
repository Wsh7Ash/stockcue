/* stockcue built-in sample shop (deterministic, fixed seed, no Math.random). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.StockcueSamples = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Fixed seed (LCG, Numerical Recipes constants) - never changes, so the
  // sample shop is identical on every machine and every run.
  var SEED = 20261012;
  var DAY_MS = 86400000;
  var WINDOW_START_UTC = Date.UTC(2026, 6, 1); // 2026-07-01
  var WINDOW_DAYS = 72; // through 2026-09-10 inclusive (72 days of daily sales)

  function makeRng(seed) {
    var state = seed >>> 0;
    return function next() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function isoDate(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
  }

  // sku, name, base daily demand, variance, chance of a zero day, lead, supplier, on-hand
  var SKU_DEFS = [
    { sku: "TEA-GREEN-100", name: "Green Tea 100g", base: 8, variance: 3, zeroChance: 0.04, lead: 10, supplier: "Leaf & Co", onHand: 55 },
    { sku: "COFF-BEAN-250", name: "Coffee Beans 250g", base: 12, variance: 4, zeroChance: 0.02, lead: 7, supplier: "Roast House", onHand: 30 },
    { sku: "MUG-CER-WHT", name: "Ceramic Mug White", base: 2, variance: 2, zeroChance: 0.35, lead: 14, supplier: "ClayWorks", onHand: 40 },
    { sku: "NOTE-A5-LIN", name: "A5 Lined Notebook", base: 5, variance: 2, zeroChance: 0.08, lead: 5, supplier: "PaperMill", onHand: 90 },
    { sku: "PEN-BALL-BLK", name: "Ballpoint Pen Black", base: 15, variance: 5, zeroChance: 0.02, lead: 3, supplier: "InkRight", onHand: 25 },
    { sku: "CAND-BSW-120", name: "Beeswax Candle 120g", base: 1, variance: 1, zeroChance: 0.45, lead: 21, supplier: "Wickery", onHand: 18 },
    { sku: "SOAP-LAV-100", name: "Lavender Soap 100g", base: 4, variance: 2, zeroChance: 0.15, lead: 12, supplier: "CleanBar", onHand: 12 },
    { sku: "HONEY-WLD-250", name: "Wildflower Honey 250g", base: 3, variance: 2, zeroChance: 0.2, lead: 18, supplier: "Apiary North", onHand: 60 },
    { sku: "TOTE-CAN-NAT", name: "Canvas Tote Natural", base: 6, variance: 3, zeroChance: 0.06, lead: 9, supplier: "Stitchery", onHand: 14 },
    { sku: "TEA-HERB-050", name: "Herbal Tea Sampler 50g", base: 0, variance: 0, zeroChance: 1, lead: 10, supplier: "Leaf & Co", onHand: 48 },
    { sku: "BOTT-STEEL-500", name: "Steel Bottle 500ml", base: 3, variance: 2, zeroChance: 0.25, lead: 16, supplier: "HydraMetal", onHand: 5 },
    { sku: "SOCK-WOL-GRY", name: "Wool Socks Grey", base: 4, variance: 2, zeroChance: 0.12, lead: 11, supplier: "Knitwell", onHand: 35 }
  ];

  function sampleInventory() {
    return SKU_DEFS.map(function (d) {
      return {
        sku: d.sku,
        name: d.name,
        onHand: d.onHand,
        leadTimeDays: d.lead,
        supplier: d.supplier
      };
    });
  }

  function sampleWindowDates() {
    var dates = [];
    for (var i = 0; i < WINDOW_DAYS; i++) {
      dates.push(isoDate(WINDOW_START_UTC + i * DAY_MS));
    }
    return dates;
  }

  function sampleSales() {
    var rng = makeRng(SEED);
    var dates = sampleWindowDates();
    var sales = [];
    for (var s = 0; s < SKU_DEFS.length; s++) {
      var def = SKU_DEFS[s];
      if (def.base === 0) continue; // zero-demand SKU: no sales rows at all
      for (var d = 0; d < dates.length; d++) {
        if (rng() < def.zeroChance) continue;
        var wobble = Math.floor(rng() * (def.variance * 2 + 1)) - def.variance;
        var qty = def.base + wobble;
        if (qty < 0) qty = 0;
        if (qty === 0) continue;
        sales.push({ date: dates[d], sku: def.sku, qty: qty });
      }
    }
    return sales;
  }

  function salesCsvRows() {
    var rows = [["date", "sku", "qty"]];
    var sales = sampleSales();
    for (var i = 0; i < sales.length; i++) {
      rows.push([sales[i].date, sales[i].sku, String(sales[i].qty)]);
    }
    return rows;
  }

  function inventoryCsvRows() {
    var rows = [["sku", "name", "on_hand", "lead_time_days", "supplier"]];
    var inv = sampleInventory();
    for (var i = 0; i < inv.length; i++) {
      rows.push([
        inv[i].sku,
        inv[i].name,
        String(inv[i].onHand),
        String(inv[i].leadTimeDays),
        inv[i].supplier
      ]);
    }
    return rows;
  }

  return {
    SEED: SEED,
    WINDOW_START: isoDate(WINDOW_START_UTC),
    WINDOW_DAYS: WINDOW_DAYS,
    sampleInventory: sampleInventory,
    sampleSales: sampleSales,
    sampleWindowDates: sampleWindowDates,
    salesCsvRows: salesCsvRows,
    inventoryCsvRows: inventoryCsvRows
  };
});
