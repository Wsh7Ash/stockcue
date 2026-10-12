/* stockcue reorder-point math (pure, deterministic, no DOM). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.StockcueCalc = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SERVICE_LEVEL_Z = {
    "90": 1.28,
    "95": 1.65,
    "99": 2.33
  };

  var URGENCY_ORDER = { critical: 0, order: 1, watch: 2, ok: 3, "no-demand": 4 };
  var URGENCY_LABELS = {
    critical: "Critical",
    order: "Order",
    watch: "Watch",
    ok: "OK",
    "no-demand": "No demand"
  };

  function zForServiceLevel(level) {
    var key = String(level).replace("%", "");
    if (Object.prototype.hasOwnProperty.call(SERVICE_LEVEL_Z, key)) {
      return SERVICE_LEVEL_Z[key];
    }
    throw new Error("Unknown service level: " + level);
  }

  function isFiniteNumber(v) {
    return typeof v === "number" && isFinite(v);
  }

  /**
   * distinctDates(salesRows) -> sorted array of unique YYYY-MM-DD dates.
   * salesRows: [{ date, sku, qty }]
   */
  function distinctDates(salesRows) {
    var seen = Object.create(null);
    var out = [];
    for (var i = 0; i < salesRows.length; i++) {
      var d = salesRows[i].date;
      if (!seen[d]) {
        seen[d] = true;
        out.push(d);
      }
    }
    out.sort();
    return out;
  }

  /**
   * avgDailyDemand(salesRows, windowDates) -> number.
   * total qty sold across salesRows (optionally pre-filtered to a window)
   * divided by number of distinct days in windowDates. 0 when no days or no sales.
   */
  function avgDailyDemand(salesRows, windowDates) {
    var days = windowDates && windowDates.length
      ? windowDates.length
      : distinctDates(salesRows).length;
    if (days === 0) return 0;
    var total = 0;
    for (var i = 0; i < salesRows.length; i++) {
      total += Number(salesRows[i].qty) || 0;
    }
    return total / days;
  }

  /**
   * populationStdDev(values) -> number (0 for empty or single value).
   */
  function populationStdDev(values) {
    var n = values.length;
    if (n === 0) return 0;
    var sum = 0;
    for (var i = 0; i < n; i++) sum += values[i];
    var mean = sum / n;
    var sq = 0;
    for (var j = 0; j < n; j++) {
      var d = values[j] - mean;
      sq += d * d;
    }
    return Math.sqrt(sq / n);
  }

  /**
   * dailyDemandSeries(salesRows, windowDates) -> array of totals per window day.
   * Days with no sales rows contribute 0.
   */
  function dailyDemandSeries(salesRows, windowDates) {
    var byDate = Object.create(null);
    for (var i = 0; i < salesRows.length; i++) {
      var r = salesRows[i];
      byDate[r.date] = (byDate[r.date] || 0) + (Number(r.qty) || 0);
    }
    var series = [];
    for (var d = 0; d < windowDates.length; d++) {
      series.push(byDate[windowDates[d]] || 0);
    }
    return series;
  }

  /**
   * demandStdDev(salesRows, windowDates) -> population stddev of the daily
   * demand series over the window (zero-demand days filled with 0).
   */
  function demandStdDev(salesRows, windowDates) {
    var dates = windowDates && windowDates.length
      ? windowDates
      : distinctDates(salesRows);
    if (dates.length === 0) return 0;
    return populationStdDev(dailyDemandSeries(salesRows, dates));
  }

  /**
   * safetyStockUnits({ mode, manualUnits, z, demandStddev, leadTimeDays }) -> integer.
   * manual mode: ceil(manualUnits); auto mode: ceil(z * stddev * sqrt(lead)).
   */
  function computeSafetyStock(opts) {
    var mode = opts.mode || "manual";
    if (mode === "manual") {
      var manual = Number(opts.manualUnits);
      if (!isFiniteNumber(manual) || manual < 0) manual = 0;
      return Math.ceil(manual);
    }
    if (mode === "auto") {
      var z = typeof opts.z === "number" ? opts.z : zForServiceLevel(opts.serviceLevel || "95");
      var sd = Number(opts.demandStddev) || 0;
      var lead = Number(opts.leadTimeDays) || 0;
      if (z < 0 || sd < 0 || lead < 0) return 0;
      return Math.ceil(z * sd * Math.sqrt(lead));
    }
    throw new Error("Unknown safety stock mode: " + mode);
  }

  function reorderPoint(avgDailyDemandValue, leadTimeDays, safetyStockUnits) {
    return Math.ceil(avgDailyDemandValue * leadTimeDays + safetyStockUnits);
  }

  function suggestedOrderQty(avgDailyDemandValue, leadTimeDays, reviewDays, safetyStockUnits, onHand) {
    var review = Number(reviewDays) || 0;
    var raw =
      avgDailyDemandValue * (leadTimeDays + review) + safetyStockUnits - onHand;
    return Math.max(0, Math.ceil(raw));
  }

  /**
   * daysOfCover(onHand, avgDailyDemand) -> number | Infinity.
   * Infinity when avg demand is 0 (documented sentinel: UI shows "inf").
   */
  function daysOfCover(onHand, avgDailyDemandValue) {
    if (avgDailyDemandValue <= 0) return Infinity;
    return onHand / avgDailyDemandValue;
  }

  /**
   * classifyUrgency({ onHand, safetyStock, reorderPoint, avgDailyDemand }) -> status.
   * - "no-demand" when avg demand == 0 (regardless of stock).
   * - critical  when on_hand < safety_stock
   * - order     when on_hand <= reorder_point (and >= safety stock)
   * - watch     when on_hand <= reorder_point * 1.25
   * - ok        otherwise
   */
  function classifyUrgency(o) {
    if (!(o.avgDailyDemand > 0)) return "no-demand";
    if (o.onHand < o.safetyStock) return "critical";
    if (o.onHand <= o.reorderPoint) return "order";
    if (o.onHand <= o.reorderPoint * 1.25) return "watch";
    return "ok";
  }

  function round2(v) {
    return Math.round(v * 100) / 100;
  }

  /**
   * explainWhy(row) -> plain-language sentence describing the arithmetic.
   */
  function explainWhy(r) {
    function num(v) {
      if (v === Infinity) return "inf";
      if (Number.isInteger(v)) return String(v);
      return String(round2(v));
    }
    if (r.urgency === "no-demand") {
      return "No sales in window; suggestion stays 0" +
        (r.onHand === 0 ? " (stock is also 0)." : ".");
    }
    if (r.urgency === "critical") {
      return (
        num(r.onHand) + " on hand is below the " + num(r.safetyStock) +
        "-unit safety stock (cover " + num(r.daysOfCover) + " days)."
      );
    }
    if (r.urgency === "order") {
      var safetyDays = num(round2(r.safetyStock / r.avgDailyDemand));
      return (
        num(r.daysOfCover) + " days cover <= " + num(r.leadTimeDays) +
        "-day lead + " + safetyDays + " safety days (ROP " + num(r.reorderPoint) + ")."
      );
    }
    if (r.urgency === "watch") {
      var threshold = Math.ceil(r.reorderPoint * 1.25);
      return (
        num(r.daysOfCover) + " days cover <= 125% of ROP (" + num(threshold) +
        "); order soon (ROP " + num(r.reorderPoint) + ")."
      );
    }
    var okSafetyDays = num(round2(r.safetyStock / r.avgDailyDemand));
    return (
      num(r.daysOfCover) + " days cover > " + num(r.leadTimeDays) +
      "-day lead + " + okSafetyDays + " safety days (ROP " + num(r.reorderPoint) + ")."
    );
  }

  /**
   * evaluateSku({ sku, name, onHand, leadTimeDays, supplier }, context) -> result row.
   * context: { salesRows (already filtered to this SKU and window),
   *            windowDates, reviewDays, safetyMode, manualUnits, serviceLevel }
   */
  function evaluateSku(skuInfo, context) {
    var windowDates = context.windowDates || distinctDates(context.salesRows || []);
    var avg = avgDailyDemand(context.salesRows || [], windowDates);
    var stddev = demandStdDev(context.salesRows || [], windowDates);
    var lead = Number(skuInfo.leadTimeDays) || 0;
    var review = Number(context.reviewDays) || 0;
    var safety = computeSafetyStock({
      mode: context.safetyMode || "manual",
      manualUnits: context.manualUnits,
      serviceLevel: context.serviceLevel,
      demandStddev: stddev,
      leadTimeDays: lead
    });
    var rop = reorderPoint(avg, lead, safety);
    var suggest = suggestedOrderQty(avg, lead, review, safety, skuInfo.onHand);
    var cover = daysOfCover(skuInfo.onHand, avg);
    var urgency = classifyUrgency({
      onHand: skuInfo.onHand,
      safetyStock: safety,
      reorderPoint: rop,
      avgDailyDemand: avg
    });
    if (urgency === "no-demand") suggest = 0;

    var row = {
      sku: skuInfo.sku,
      name: skuInfo.name || "",
      onHand: skuInfo.onHand,
      leadTimeDays: lead,
      supplier: skuInfo.supplier || "",
      avgDailyDemand: round2(avg),
      demandStddev: round2(stddev),
      safetyStock: safety,
      safetyMode: context.safetyMode || "manual",
      reorderPoint: rop,
      reviewDays: review,
      suggestedQty: suggest,
      daysOfCover: cover === Infinity ? Infinity : round2(cover),
      urgency: urgency
    };
    row.why = explainWhy(row);
    return row;
  }

  /**
   * evaluateShop({ inventory, sales, windowDates, reviewDays, safetyMode,
   *                manualUnits, serviceLevel, leadOverrides }) -> rows sorted
   * by urgency rank then SKU.
   */
  function evaluateShop(input) {
    var inventory = input.inventory || [];
    var sales = input.sales || [];
    var windowDates = input.windowDates || distinctDates(sales);
    var overrides = input.leadOverrides || {};
    var salesBySku = Object.create(null);
    for (var i = 0; i < sales.length; i++) {
      var s = sales[i];
      (salesBySku[s.sku] || (salesBySku[s.sku] = [])).push(s);
    }
    var rows = [];
    for (var k = 0; k < inventory.length; k++) {
      var item = inventory[k];
      var lead = Object.prototype.hasOwnProperty.call(overrides, item.sku)
        ? overrides[item.sku]
        : item.leadTimeDays;
      rows.push(
        evaluateSku(
          { sku: item.sku, name: item.name, onHand: item.onHand, leadTimeDays: lead, supplier: item.supplier },
          {
            salesRows: salesBySku[item.sku] || [],
            windowDates: windowDates,
            reviewDays: input.reviewDays,
            safetyMode: input.safetyMode,
            manualUnits: input.manualUnits,
            serviceLevel: input.serviceLevel
          }
        )
      );
    }
    rows.sort(function (a, b) {
      var d = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
      if (d !== 0) return d;
      if (a.sku < b.sku) return -1;
      if (a.sku > b.sku) return 1;
      return 0;
    });
    return rows;
  }

  function summarize(rows) {
    var counts = { critical: 0, order: 0, watch: 0, ok: 0, "no-demand": 0 };
    for (var i = 0; i < rows.length; i++) {
      counts[rows[i].urgency] += 1;
    }
    return { total: rows.length, counts: counts };
  }

  return {
    SERVICE_LEVEL_Z: SERVICE_LEVEL_Z,
    URGENCY_ORDER: URGENCY_ORDER,
    URGENCY_LABELS: URGENCY_LABELS,
    zForServiceLevel: zForServiceLevel,
    distinctDates: distinctDates,
    avgDailyDemand: avgDailyDemand,
    populationStdDev: populationStdDev,
    dailyDemandSeries: dailyDemandSeries,
    demandStdDev: demandStdDev,
    computeSafetyStock: computeSafetyStock,
    reorderPoint: reorderPoint,
    suggestedOrderQty: suggestedOrderQty,
    daysOfCover: daysOfCover,
    classifyUrgency: classifyUrgency,
    explainWhy: explainWhy,
    evaluateSku: evaluateSku,
    evaluateShop: evaluateShop,
    summarize: summarize
  };
});
