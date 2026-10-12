"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { parse, parseWithHeader, stringify, escapeField } = require("../src/csv.js");

test("csv: parses simple unquoted rows", () => {
  assert.deepStrictEqual(parse("a,b\n1,2"), [["a", "b"], ["1", "2"]]);
});

test("csv: empty string yields no rows", () => {
  assert.deepStrictEqual(parse(""), []);
});

test("csv: quoted field may contain commas", () => {
  assert.deepStrictEqual(parse('a,"b,c",d\n1,2,3'), [["a", "b,c", "d"], ["1", "2", "3"]]);
});

test("csv: escaped double quotes inside quoted field", () => {
  assert.deepStrictEqual(parse('a,"say ""hi""",b'), [["a", 'say "hi"', "b"]]);
});

test("csv: CRLF line endings", () => {
  assert.deepStrictEqual(parse("a,b\r\n1,2\r\n"), [["a", "b"], ["1", "2"]]);
});

test("csv: lone CR line endings", () => {
  assert.deepStrictEqual(parse("a,b\r1,2"), [["a", "b"], ["1", "2"]]);
});

test("csv: trailing newline does not create an empty row", () => {
  assert.deepStrictEqual(parse("a,b\n"), [["a", "b"]]);
});

test("csv: empty fields are preserved", () => {
  assert.deepStrictEqual(parse("a,,c\n,, "), [["a", "", "c"], ["", "", " "]]);
});

test("csv: quoted field may span lines", () => {
  assert.deepStrictEqual(parse('"line1\nline2",b'), [["line1\nline2", "b"]]);
});

test("csv: unterminated quote throws CsvError", () => {
  assert.throws(() => parse('a,"unterminated'), (err) => err.name === "CsvError");
});

test("csv: quote inside unquoted field throws", () => {
  assert.throws(() => parse('a,b"c\n1,2'), (err) => err.name === "CsvError");
});

test("csv: non-string input throws", () => {
  assert.throws(() => parse(42), (err) => err.name === "CsvError");
});

test("csv: parseWithHeader builds objects keyed by header", () => {
  const out = parseWithHeader("date,sku,qty\n2026-01-01,A,3\n");
  assert.deepStrictEqual(out.headers, ["date", "sku", "qty"]);
  assert.deepStrictEqual(out.rows, [{ date: "2026-01-01", sku: "A", qty: "3" }]);
});

test("csv: parseWithHeader skips blank lines", () => {
  const out = parseWithHeader("date,sku,qty\n\n2026-01-01,A,3\n\n");
  assert.strictEqual(out.rows.length, 1);
});

test("csv: parseWithHeader rejects wrong column count", () => {
  assert.throws(
    () => parseWithHeader("a,b\n1,2,3\n"),
    (err) => err.name === "CsvError" && /columns/.test(err.message)
  );
});

test("csv: parseWithHeader rejects empty file", () => {
  assert.throws(() => parseWithHeader(""), (err) => err.name === "CsvError");
});

test("csv: escapeField quotes special characters", () => {
  assert.strictEqual(escapeField("plain"), "plain");
  assert.strictEqual(escapeField('has,comma'), '"has,comma"');
  assert.strictEqual(escapeField('say "hi"'), '"say ""hi"""');
  assert.strictEqual(escapeField("two\nlines"), '"two\nlines"');
});

test("csv: stringify then parse round-trips", () => {
  const rows = [
    ["sku", "name"],
    ["A-1", 'Widget, "deluxe"'],
    ["B-2", "line\nbreak"]
  ];
  assert.deepStrictEqual(parse(stringify(rows)), rows);
});
