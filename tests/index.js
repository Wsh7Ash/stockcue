"use strict";

// Entry point so `node --test tests` works on Node versions where an explicit
// directory argument is executed rather than globbed. Requires every test file;
// plain `node --test` still discovers the *.test.cjs files directly.
require("./csv.test.cjs");
require("./calc.test.cjs");
require("./samples.test.cjs");
require("./export.test.cjs");
require("./html.test.cjs");
