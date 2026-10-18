#!/bin/sh
# Campanula 的专用浏览器（chrome-devtools-axi）：会话名 campanula，登录存在 ~/.cache/campanula-axi/chrome-profile，
# 用看得见的窗口打开。作者在这个窗口里扫码登录一次，之后一直沿用；不碰作者平时用的 Chrome。
# 用法：scripts/axi <chrome-devtools-axi 的命令>，例如 scripts/axi eval "location.href"。
# scripts/axi port：打印桥接进程的端口（没开就先开）。sweep.py、take-login.mts 直接往这个端口的 /call 发 DevTools 工具调用，
# 那是 axi 0.1.44 没写进 README 的内部接口，所以这里固定版本：升级前先确认 /call 的请求和返回没变，再改 VERSION。
set -eu
VERSION=0.1.44
export CHROME_DEVTOOLS_AXI_SESSION=campanula
export CHROME_DEVTOOLS_AXI_USER_DATA_DIR="$HOME/.cache/campanula-axi/chrome-profile"
export CHROME_DEVTOOLS_AXI_HEADED=1

if [ "${1:-}" = port ]; then
  installed=$(chrome-devtools-axi --version 2>/dev/null || echo 没装)
  if [ "$installed" != "$VERSION" ]; then
    echo "要 chrome-devtools-axi $VERSION，装的是 $installed：npm install -g chrome-devtools-axi@$VERSION" >&2
    exit 1
  fi
  # 没开就开；开着就做一次健康检查，浏览器没了会重开
  chrome-devtools-axi pages > /dev/null
  sed -n 's/.*"port":\([0-9]*\).*/\1/p' "$HOME/.chrome-devtools-axi/sessions/campanula/bridge.pid"
  exit 0
fi

exec chrome-devtools-axi "$@"
