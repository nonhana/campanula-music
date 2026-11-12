#!/bin/sh
set -eu
if [ "${1:-}" = show-trace ]; then
  shift
  ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
  CLI=$(cd "$ROOT" && node -e '
    const { createRequire } = require("node:module");
    const { dirname, resolve } = require("node:path");
    const fromCli = createRequire(require.resolve("@playwright/cli/playwright-cli.js"));
    const pkg = fromCli.resolve("playwright/package.json");
    console.log(resolve(dirname(pkg), fromCli("playwright/package.json").bin.playwright));
  ')
  exec node "$CLI" show-trace "$@"
fi
exec "$(dirname "$0")/browser.sh" playwright "$@"
