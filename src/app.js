/* stockcue app wiring (DOM only; math is in calc.js). Classic script. */
(function () {
  "use strict";

  if (typeof document === "undefined") return; // Node: nothing to wire

  var state = {
    sales: null,
    inventory: null,
    windowDates: [],
    leadOverrides: {},
    lastRows: []
  };

  function $(id) {
    return document.getElementById(id);
  }

  function numInput(el, fallback) {
    var v = parseFloat(el.value);
    return isFinite(v) && v >= 0 ? v : fallback;
  }

  function context() {
    return {
      sales: state.sales || [],
      inventory: state.inventory || [],
      windowDates: state.windowDates,
      reviewDays: numInput($("review-days"), 7),
      safetyMode: document.querySelector('input[name="safety-mode"]:checked').value,
      manualUnits: numInput($("manual-safety"), 10),
      serviceLevel: $("service-level").value,
      leadOverrides: state.leadOverrides
    };
  }

  function setStatus(msg, kind) {
    var el = $("status");
    el.textContent = msg || "";
    el.className = "status" + (kind ? " status-" + kind : "");
  }

  function render() {
    var hasData = state.inventory && state.inventory.length >= 0 && state.sales;
    if (!hasData) {
      $("table-body").innerHTML =
        '<tr><td colspan="11" class="empty-cell">No data yet. Click <strong>Load sample shop</strong> or import your CSV files.</td></tr>';
      $("summary").innerHTML = "";
      state.lastRows = [];
      return;
    }
    var rows = StockcueCalc.evaluateShop(context());
    state.lastRows = rows;
    $("table-body").innerHTML = StockcueRender.tableBodyHtml(rows);
    var summary = StockcueCalc.summarize(rows);
    $("summary").innerHTML = StockcueRender.summaryHtml(summary, state.windowDates);

    var inputs = $("table-body").querySelectorAll(".lead-input");
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].addEventListener("change", onLeadChange);
    }
  }

  function onLeadChange(e) {
    var row = e.target.closest("tr");
    var sku = row && row.getAttribute("data-sku");
    if (!sku) return;
    var v = parseFloat(e.target.value);
    if (isFinite(v) && v >= 0) {
      state.leadOverrides[sku] = Math.round(v);
    } else {
      delete state.leadOverrides[sku];
    }
    render();
  }

  function loadSample() {
    state.sales = StockcueSamples.sampleSales();
    state.inventory = StockcueSamples.sampleInventory();
    state.windowDates = StockcueSamples.sampleWindowDates();
    state.leadOverrides = {};
    setStatus("Sample shop loaded: " + state.inventory.length + " SKUs, " + state.windowDates.length + " day window.", "ok");
    render();
  }

  function parseSalesCsv(text) {
    var parsed = StockcueCsv.parseWithHeader(text);
    var need = ["date", "sku", "qty"];
    for (var i = 0; i < need.length; i++) {
      if (parsed.headers.indexOf(need[i]) === -1) {
        throw new Error('Sales CSV must have columns: date,sku,qty (missing "' + need[i] + '")');
      }
    }
    var rows = [];
    for (var r = 0; r < parsed.rows.length; r++) {
      var row = parsed.rows[r];
      var qty = parseFloat(row.qty);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date.trim())) {
        throw new Error('Sales CSV row ' + (r + 2) + ': date must be YYYY-MM-DD, got "' + row.date + '"');
      }
      if (!isFinite(qty) || qty < 0) {
        throw new Error('Sales CSV row ' + (r + 2) + ': qty must be a non-negative number, got "' + row.qty + '"');
      }
      rows.push({ date: row.date.trim(), sku: row.sku.trim(), qty: qty });
    }
    return rows;
  }

  function parseInventoryCsv(text) {
    var parsed = StockcueCsv.parseWithHeader(text);
    var need = ["sku", "name", "on_hand", "lead_time_days", "supplier"];
    for (var i = 0; i < need.length; i++) {
      if (parsed.headers.indexOf(need[i]) === -1) {
        throw new Error('Inventory CSV must have columns: sku,name,on_hand,lead_time_days,supplier (missing "' + need[i] + '")');
      }
    }
    var rows = [];
    var seen = Object.create(null);
    for (var r = 0; r < parsed.rows.length; r++) {
      var row = parsed.rows[r];
      var onHand = parseFloat(row.on_hand);
      var lead = parseFloat(row.lead_time_days);
      var sku = row.sku.trim();
      if (!sku) throw new Error("Inventory CSV row " + (r + 2) + ": sku is empty");
      if (seen[sku]) throw new Error('Inventory CSV row ' + (r + 2) + ': duplicate sku "' + sku + '"');
      seen[sku] = true;
      if (!isFinite(onHand) || onHand < 0) {
        throw new Error('Inventory CSV row ' + (r + 2) + ': on_hand must be a non-negative number, got "' + row.on_hand + '"');
      }
      if (!isFinite(lead) || lead < 0) {
        throw new Error('Inventory CSV row ' + (r + 2) + ': lead_time_days must be a non-negative number, got "' + row.lead_time_days + '"');
      }
      rows.push({
        sku: sku,
        name: row.name.trim(),
        onHand: onHand,
        leadTimeDays: lead,
        supplier: row.supplier.trim()
      });
    }
    return rows;
  }

  function readFile(inputEl) {
    return new Promise(function (resolve, reject) {
      var file = inputEl.files && inputEl.files[0];
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () {
        reject(new Error("Could not read file: " + file.name));
      };
      reader.onload = function () {
        resolve(String(reader.result));
      };
      reader.readAsText(file);
    });
  }

  function handleImport() {
    var salesEl = $("sales-file");
    var invEl = $("inventory-file");
    var tasks = [];
    tasks.push(
      salesEl.files && salesEl.files[0]
        ? readFile(salesEl).then(parseSalesCsv)
        : Promise.resolve(state.sales)
    );
    tasks.push(
      invEl.files && invEl.files[0]
        ? readFile(invEl).then(parseInventoryCsv)
        : Promise.resolve(state.inventory)
    );
    Promise.all(tasks)
      .then(function (out) {
        var sales = out[0];
        var inventory = out[1];
        if (!sales || !inventory) {
          throw new Error("Import needs a sales CSV and an inventory CSV (or load the sample first)");
        }
        state.sales = sales;
        state.inventory = inventory;
        state.windowDates = StockcueCalc.distinctDates(sales);
        state.leadOverrides = {};
        setStatus("Imported " + inventory.length + " SKUs, " + sales.length + " sales rows.", "ok");
        render();
      })
      .catch(function (err) {
        setStatus(err.message || String(err), "error");
      });
  }

  function exportOrders() {
    if (!state.lastRows.length) {
      setStatus("Nothing to export yet - load data first.", "error");
      return;
    }
    var orderRows = state.lastRows.filter(function (r) {
      return r.urgency === "critical" || r.urgency === "order";
    });
    if (orderRows.length === 0) {
      setStatus("Nothing to order: no SKUs are critical or in order status.", "ok");
      return;
    }
    var csv = StockcueCsv.stringify([
      ["sku", "name", "action", "suggested_qty", "on_hand", "lead_time_days", "supplier", "urgency"]
    ].concat(
      orderRows.map(function (r) {
        return [r.sku, r.name, "order", r.suggestedQty, r.onHand, r.leadTimeDays, r.supplier, r.urgency];
      })
    ));
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "stockcue-order-list.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus("Exported " + orderRows.length + " order line(s) to stockcue-order-list.csv", "ok");
  }

  function bindControls() {
    $("btn-sample").addEventListener("click", loadSample);
    $("btn-import").addEventListener("click", handleImport);
    $("btn-export").addEventListener("click", exportOrders);
    $("review-days").addEventListener("input", render);
    $("manual-safety").addEventListener("input", render);
    $("service-level").addEventListener("change", render);
    var modes = document.querySelectorAll('input[name="safety-mode"]');
    for (var i = 0; i < modes.length; i++) {
      modes[i].addEventListener("change", function () {
        var manualRow = $("manual-safety-row");
        var autoRow = $("service-level-row");
        var isAuto = document.querySelector('input[name="safety-mode"]:checked').value === "auto";
        manualRow.hidden = isAuto;
        autoRow.hidden = !isAuto;
        render();
      });
    }
  }

  bindControls();
  render();
})();
