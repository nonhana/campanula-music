#!/bin/sh
# Campanula 的专用浏览器（chrome-devtools-axi）：会话名 campanula，登录存在 ~/.cache/campanula-axi/chrome-profile，
# 用看得见的窗口打开。作者在这个窗口里扫码登录一次，之后一直沿用；不碰作者平时用的 Chrome。
# 用法：scripts/axi.sh <chrome-devtools-axi 的命令>，例如 scripts/axi.sh eval "location.href"。
# /call 是 axi 的内部接口；axi 和 DevTools 的版本由项目依赖固定，升级后要跑 mock smoke。
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
export CHROME_DEVTOOLS_AXI_SESSION="${CHROME_DEVTOOLS_AXI_SESSION:-campanula}"
export CHROME_DEVTOOLS_AXI_USER_DATA_DIR="${CHROME_DEVTOOLS_AXI_USER_DATA_DIR:-$HOME/.cache/campanula-axi/chrome-profile}"
export CHROME_DEVTOOLS_AXI_HEADED=1
export CHROME_DEVTOOLS_AXI_MCP_PATH="$ROOT/node_modules/chrome-devtools-mcp/out/Default/gen/src/bin/chrome-devtools-mcp.js"

axi() {
  pnpm --dir "$ROOT" exec chrome-devtools-axi "$@"
}

if [ "${1:-}" = port ]; then
  # 没开就开；开着就做一次健康检查，浏览器没了会重开
  axi pages > /dev/null
  sed -n 's/.*"port":\([0-9]*\).*/\1/p' "$HOME/.chrome-devtools-axi/sessions/$CHROME_DEVTOOLS_AXI_SESSION/bridge.pid"
  exit 0
fi

exec pnpm --dir "$ROOT" exec chrome-devtools-axi "$@"
