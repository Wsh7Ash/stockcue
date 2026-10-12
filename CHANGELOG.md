# Changelog

All notable changes to stockcue are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) principles; versions are
semantic.

## [0.1.0] - 2026-10-12

### Added

- Initial release: offline reorder-point advisor as a static web page.
- Core math: average daily demand, population stddev of zero-filled daily
  demand series, reorder point, manual + auto safety stock (z-table
  1.28/1.65/2.33), suggested order quantity with review-days horizon, days
  of cover, five-state urgency classification with plain-language why-text.
- Hand-written RFC-4180-ish CSV parser/exporter (quotes, escaped quotes,
  commas in quotes, CRLF/LF/CR, trailing newline, graceful errors).
- Deterministic built-in sample shop (12 SKUs, 72-day window, fixed seed -
  no Math.random anywhere).
- UI: settings panel, sample loader, CSV import (sales + inventory), order
  list CSV export, urgency-sorted table with row highlighting and badges,
  inline per-SKU lead-time editing, summary strip, empty/error states,
  assumptions disclaimer.
- Node test suite (65 cases) with zero dependencies; optional headless
  Chrome smoke test; CI workflow that tests and verifies artifact
  determinism.
- Docs: README, PROJECT_SPEC, ARCHITECTURE, USAGE, SECURITY, CONTRIBUTING;
  committed demo artifacts under `results/`.
