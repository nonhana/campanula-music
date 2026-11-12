#!/bin/sh
# 浏览器命令和诊断共用一把锁。
# mock 是默认；真账号加 --real，只用于交付前由作者试用。
exec pnpm exec tsx "$(dirname "$0")/browser.mts" "$@"
