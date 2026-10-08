#!/usr/bin/env bash
# Run all tests. Used locally and by CI.
#
#   PHP_BIN   path to the php binary (default: php)
#   CHROME_BIN path to chromium/chrome for the integration test
set -euo pipefail
cd "$(dirname "$0")/.."

PHP_BIN="${PHP_BIN:-php}"
export PHP_BIN

echo "== PHP: recipe-data =="
"$PHP_BIN" tests/php/test-recipe-data.php

echo "== JS: parsing =="
node tests/js/parsing.test.js

echo "== JS: scaling =="
node tests/js/scaling.test.js

echo "== Integration: links + scaler =="
node tests/integration/links.test.js
