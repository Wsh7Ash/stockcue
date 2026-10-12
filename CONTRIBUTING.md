# Contributing to stockcue

Thanks for considering a contribution. stockcue is deliberately small,
offline, and dependency-free - keep it that way.

## Ground rules

- No build step, no bundler, no npm dependencies, no CDN links, no ES
  modules. The app must keep working by double-clicking `index.html` over
  `file://`.
- ASCII-only source files. No absolute machine paths. No secrets.
- `src/calc.js`, `src/csv.js`, and `src/samples.js` stay pure (no DOM, no
  globals beyond the UMD guard) so the Node tests exercise browser code.

## Workflow

1. Fork and create a feature branch.
2. Make your change. Match the existing code style (classic scripts,
   2-space indent, JSDoc-ish comments on public functions).
3. Add or extend tests in `tests/*.test.cjs` - every behavior change needs
   a test. Run `node --test tests` and make sure everything passes.
4. If your change affects computed numbers or committed artifacts, run
   `node tools/generate-artifacts.cjs` and commit the regenerated
   `examples/` and `results/` files.
5. Optionally run `node tools/smoke.mjs` if you have Chrome or Edge
   installed (verifies the page renders over file://).
6. Update `CHANGELOG.md` under an `Unreleased` heading.

## Ideas welcome

Roadmap items (JSON import, multi-location, PO PDF export) and doc fixes
are especially welcome. Please open an issue first for anything structural.
