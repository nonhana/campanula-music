#!/bin/sh
set -eu
# 临时命名空间无外网出口；虚拟链路让浏览器识别本机在线，退出后由内核回收。
exec sudo unshare --net -- sh -ec '
  ip link set lo up
  ip link add camp-local type dummy
  ip addr add 192.0.2.1/32 dev camp-local
  ip link set camp-local up
  task_user=$1
  task_path=$2
  shift 2
  exec runuser -u "$task_user" -- env "PATH=$task_path" sh -ec '\''
    mkdir -p .reports/offline
    offline_report=$(mktemp -d .reports/offline/run-XXXXXX)
    ip -j addr show > "$offline_report/addresses.json"
    ip -j route show table all > "$offline_report/routes.json"
    if ip route get 203.0.113.1 > "$offline_report/ipv4-egress.txt" 2>&1; then exit 1; fi
    if ip -6 route get 2001:db8::1 > "$offline_report/ipv6-egress.txt" 2>&1; then exit 1; fi
    exec "$@"
  '\'' sh "$@"
' sh "$(id -un)" "$PATH" "$@"
