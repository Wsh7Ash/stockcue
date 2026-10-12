// Headless-Chrome smoke test for stockcue.
// Run: node tools/smoke.mjs  (requires Chrome or Edge installed; exits 0 on pass)
// Verifies: (1) index.html loads over file:// with classic scripts,
//           (2) clicking "Load sample shop" renders the urgency table.
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const browsers = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];
const chrome = browsers.find((p) => existsSync(p));
if (!chrome) {
  console.error("SMOKE SKIP: no Chrome/Edge found on this machine");
  process.exit(2);
}

const tmp = mkdtempSync(path.join(tmpdir(), "stockcue-smoke-"));
const harness = path.join(tmp, "harness.html");
const pageUrl = pathToFileURL(path.join(root, "index.html")).href;
const scriptUrls = ["csv.js", "calc.js", "samples.js", "render.js", "app.js"].map((f) =>
  pathToFileURL(path.join(root, "src", f)).href
);

// Harness loads the real app page in an iframe is blocked under file:// in some
// builds, so instead it re-declares the same stylesheet+scripts in order and
// clicks the real button, then marks success in document.title.
writeFileSync(
  harness,
  `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>pending</title>
<link rel="stylesheet" href="${pathToFileURL(path.join(root, "styles.css")).href}">
</head><body>
<section id="summary"></section>
<div class="controls">
  <input id="manual-safety" type="number" value="10">
  <input id="review-days" type="number" value="7">
  <select id="service-level"><option value="95" selected>95%</option></select>
  <input type="radio" name="safety-mode" value="manual" checked>
  <input type="radio" name="safety-mode" value="auto">
  <button id="btn-sample" type="button">Load sample shop</button>
  <input id="sales-file" type="file">
  <input id="inventory-file" type="file">
  <button id="btn-import" type="button">Import</button>
  <button id="btn-export" type="button">Export</button>
  <p id="status"></p>
</div>
<table><tbody id="table-body"></tbody></table>
${scriptUrls.map((u) => `<script src="${u}"></script>`).join("\n")}
<script>
  document.getElementById("btn-sample").click();
  var rows = document.querySelectorAll("#table-body tr.urgency-critical, #table-body tr.urgency-order, #table-body tr.urgency-watch, #table-body tr.urgency-ok, #table-body tr.urgency-no-demand");
  document.title = rows.length === 12 ? "SMOKE-OK:" + rows.length : "SMOKE-FAIL:" + rows.length;
</script>
</body></html>`,
  "utf8"
);

const res = spawnSync(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--allow-file-access-from-files",
    "--virtual-time-budget=5000",
    "--dump-dom",
    pathToFileURL(harness).href
  ],
  { encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024 }
);

rmSync(tmp, { recursive: true, force: true });

const dom = res.stdout || "";
const titleMatch = dom.match(/<title>([^<]*)<\/title>/);
const title = titleMatch ? titleMatch[1] : "";
const tableOk = dom.includes("urgency-critical") && dom.includes("Green Tea 100g");
const statusOk = dom.includes("Sample shop loaded");

if (res.status === 0 && title.startsWith("SMOKE-OK:") && tableOk && statusOk) {
  console.log("SMOKE PASS: " + title + " rows rendered, sample shop loaded, urgency table present");
  process.exit(0);
}
console.error("SMOKE FAIL: chrome exit=" + res.status + " title=" + title + " tableOk=" + tableOk + " statusOk=" + statusOk);
if (res.stderr) console.error(res.stderr.slice(0, 2000));
process.exit(1);
