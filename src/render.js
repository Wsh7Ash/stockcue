/* stockcue DOM rendering layer (thin; all math lives in calc.js). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.StockcueRender = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function fmtInt(n) {
    if (n === Infinity) return "inf";
    if (!isFinite(n)) return "-";
    if (Number.isInteger(n)) return String(n);
    return String(Math.round(n * 100) / 100);
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var URGENCY_LABELS = {
    critical: "Critical",
    order: "Order",
    watch: "Watch",
    ok: "OK",
    "no-demand": "No demand"
  };

  /**
   * Build tbody HTML for the reorder table. Returns a string.
   */
  function tableBodyHtml(rows) {
    if (rows.length === 0) {
      return '<tr><td colspan="11" class="empty-cell">No SKUs to show. Load the sample shop or import CSVs.</td></tr>';
    }
    var html = "";
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var label = URGENCY_LABELS[r.urgency] || r.urgency;
      html +=
        '<tr class="urgency-' + r.urgency + '" data-sku="' + esc(r.sku) + '">' +
        "<td><code>" + esc(r.sku) + "</code></td>" +
        "<td>" + esc(r.name) + "</td>" +
        '<td class="num">' + fmtInt(r.onHand) + "</td>" +
        '<td class="num">' + fmtInt(r.avgDailyDemand) + "</td>" +
        '<td class="num"><label class="sr-only" for="lead-' + esc(r.sku) + '">Lead time days for ' + esc(r.sku) + '</label>' +
        '<input class="lead-input" id="lead-' + esc(r.sku) + '" type="number" min="0" step="1" value="' + fmtInt(r.leadTimeDays) + '"></td>' +
        '<td class="num">' + fmtInt(r.safetyStock) + "</td>" +
        '<td class="num">' + fmtInt(r.reorderPoint) + "</td>" +
        '<td class="num strong">' + fmtInt(r.suggestedQty) + "</td>" +
        '<td class="num">' + fmtInt(r.daysOfCover) + "</td>" +
        '<td><span class="badge badge-' + r.urgency + '">' + esc(label) + "</span></td>" +
        '<td class="why">' + esc(r.why) + "</td>" +
        "</tr>";
    }
    return html;
  }

  function summaryHtml(summary, windowDates) {
    var span =
      windowDates && windowDates.length
        ? windowDates[0] + " to " + windowDates[windowDates.length - 1] + " (" + windowDates.length + " days)"
        : "no sales loaded";
    return (
      '<span class="sum-item"><strong>' + summary.total + "</strong> SKUs</span>" +
      '<span class="sum-item sum-critical"><strong>' + summary.counts.critical + "</strong> critical</span>" +
      '<span class="sum-item sum-order"><strong>' + summary.counts.order + "</strong> order</span>" +
      '<span class="sum-item sum-watch"><strong>' + summary.counts.watch + "</strong> watch</span>" +
      '<span class="sum-item sum-ok"><strong>' + summary.counts.ok + "</strong> ok</span>" +
      '<span class="sum-item sum-nodemand"><strong>' + summary.counts["no-demand"] + "</strong> no demand</span>" +
      '<span class="sum-item">Sales window: <strong>' + esc(span) + "</strong></span>"
    );
  }

  return {
    tableBodyHtml: tableBodyHtml,
    summaryHtml: summaryHtml,
    fmtInt: fmtInt,
    esc: esc
  };
});
