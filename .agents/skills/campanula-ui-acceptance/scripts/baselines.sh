#!/bin/sh
# 把原型分支上的截图基准一次性转成小 JPEG，放进 _notes/baselines/（作者本机，不进仓库）。
# 原图是 2 倍屏 PNG（桌面 1800 宽，共约 40 MB），直接读进上下文既贵又不稳定；
# 最长边 1100px、质量 40 的 JPEG 看得清布局和文字，一张几十 KB。
# 用法：在仓库根目录跑 sh .agents/skills/campanula-ui-acceptance/scripts/baselines.sh
# 依赖 macOS 的 sips。原型分支更新后重跑一次即可（会覆盖）。
set -eu

root=$(git rev-parse --show-toplevel)
git -C "$root" fetch -q origin prototype/visual prototype/dnd

convert() { # <分支> <分支里的目录> <输出目录名>
  out="$root/_notes/baselines/$3"
  tmp=$(mktemp -d)
  mkdir -p "$out"
  git -C "$root" ls-tree --name-only "origin/$1" "$2/" | grep '\.png$' | while read -r path; do
    name=$(basename "$path" .png)
    git -C "$root" show "origin/$1:$path" > "$tmp/$name.png"
    # 只缩小不放大：手机截图本来就不到 1100 高
    size=$(sips -g pixelWidth -g pixelHeight "$tmp/$name.png" | awk '/pixel/ { if ($2 > m) m = $2 } END { print m }')
    if [ "$size" -gt 1100 ]; then
      sips -Z 1100 -s format jpeg -s formatOptions 40 "$tmp/$name.png" --out "$out/$name.jpg" > /dev/null
    else
      sips -s format jpeg -s formatOptions 40 "$tmp/$name.png" --out "$out/$name.jpg" > /dev/null
    fi
  done
  rm -rf "$tmp"
  echo "$3: $(ls "$out" | wc -l | tr -d ' ') 张 → $out"
}

convert prototype/visual static/prototype/shots/final final
convert prototype/dnd static/prototype/shots/dnd dnd
