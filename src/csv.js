/* stockcue CSV parser + exporter (RFC-4180-ish, pure functions). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.StockcueCsv = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function CsvError(message, lineNumber) {
    var err = new Error(message);
    err.name = "CsvError";
    err.lineNumber = lineNumber || null;
    return err;
  }

  /**
   * Parse a CSV string into an array of rows (each row is an array of strings).
   * Supports quoted fields, escaped quotes (""), commas inside quotes,
   * CRLF / LF / CR line endings, and an optional trailing newline.
   * Throws CsvError on unterminated quotes or a row with no fields.
   */
  function parse(text) {
    if (typeof text !== "string") {
      throw CsvError("CSV input must be a string");
    }
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    var i = 0;
    var n = text.length;
    var line = 1;

    function endField() {
      row.push(field);
      field = "";
    }

    function endRow() {
      endField();
      rows.push(row);
      row = [];
    }

    while (i < n) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i += 1;
          continue;
        }
        if (c === "\n") {
          line += 1;
        }
        field += c;
        i += 1;
        continue;
      }
      if (c === '"') {
        if (field !== "") {
          throw CsvError('Unexpected quote inside an unquoted field (line ' + line + ")", line);
        }
        inQuotes = true;
        i += 1;
        continue;
      }
      if (c === ",") {
        endField();
        i += 1;
        continue;
      }
      if (c === "\r") {
        if (text[i + 1] === "\n") {
          i += 1;
        }
        endRow();
        line += 1;
        i += 1;
        continue;
      }
      if (c === "\n") {
        endRow();
        line += 1;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
    }

    if (inQuotes) {
      throw CsvError("Unterminated quoted field at end of input", line);
    }

    // Flush the last row only if there is pending content (handles trailing newline).
    if (field !== "" || row.length > 0) {
      endRow();
    }

    return rows;
  }

  /**
   * Parse CSV text that has a header row. Returns { headers, rows } where each
   * row is an object keyed by header name (trimmed). Blank lines are skipped.
   * Throws CsvError when the file is empty, the header is empty, or a data row
   * has a different number of columns than the header.
   */
  function parseWithHeader(text) {
    var all = parse(text);
    while (all.length > 0 && all[0].length === 1 && all[0][0].trim() === "") {
      all.shift();
    }
    if (all.length === 0) {
      throw CsvError("CSV file is empty");
    }
    var headers = all[0].map(function (h) {
      return h.trim();
    });
    if (headers.length === 0 || headers.every(function (h) { return h === ""; })) {
      throw CsvError("CSV header row is empty", 1);
    }
    var rows = [];
    for (var r = 1; r < all.length; r++) {
      var raw = all[r];
      if (raw.length === 1 && raw[0].trim() === "") {
        continue;
      }
      if (raw.length !== headers.length) {
        throw CsvError(
          "Row " + (r + 1) + " has " + raw.length + " columns, expected " + headers.length,
          r + 1
        );
      }
      var obj = {};
      for (var c = 0; c < headers.length; c++) {
        obj[headers[c]] = raw[c];
      }
      rows.push(obj);
    }
    return { headers: headers, rows: rows };
  }

  function escapeField(value) {
    var s = value === null || value === undefined ? "" : String(value);
    if (/[",\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  /**
   * Serialize a 2D array of values to CSV text (CRLF line endings, trailing CRLF).
   */
  function stringify(rows) {
    return rows
      .map(function (row) {
        return row.map(escapeField).join(",");
      })
      .join("\r\n") + "\r\n";
  }

  return {
    parse: parse,
    parseWithHeader: parseWithHeader,
    stringify: stringify,
    escapeField: escapeField
  };
});
