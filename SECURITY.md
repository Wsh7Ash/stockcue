# Security

## Summary

stockcue is designed to hold your shop's sales and inventory data only in
memory, in your browser tab, on your machine.

- **No network access.** The page makes zero HTTP requests: no fetch, no
  XMLHttpRequest, no CDN scripts, no web fonts, no analytics, no telemetry.
  You can verify with your browser's developer-tools Network tab (it stays
  empty) or by pulling your network cable after loading.
- **Data stays local.** CSV files you import are read with the FileReader
  API and parsed in the page. They are never uploaded, cached to disk by the
  app, or written anywhere by stockcue. Closing the tab discards them.
- **No storage.** stockcue uses no cookies, localStorage, IndexedDB, or
  service workers. Every session starts clean.
- **No secrets involved.** The project contains no API keys or tokens; it
  has no backend to talk to.

## Parsing safety

- CSV import is a hand-written parser with no `eval`, no regex backtracking
  on user input, and explicit error paths; malformed files produce a message
  in the UI instead of crashing.
- All data-derived strings (SKU, product name, supplier, why-text) are
  HTML-escaped before rendering, so a hostile CSV cannot inject markup or
  scripts into the page.

## Reporting a vulnerability

If you find a way to make stockcue exfiltrate data, execute unintended
code, or otherwise break its offline guarantee, please open a GitHub issue
(describe the steps to reproduce) or contact the maintainer privately if
the issue is sensitive. Fixes will be credited in the changelog.
