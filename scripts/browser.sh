#!/bin/sh
set -eu
exec pnpm exec tsx "$(dirname "$0")/../tests/tools/browser.mts" "$@"
