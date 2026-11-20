#!/bin/sh
set -eu

# Vercel Ignored Build Step 退出码约定：0 跳过构建，非 0 继续构建。
# 首次部署、浅克隆缺少上次提交、或同一提交手动 Redeploy 时均继续构建。
if [ -z "${VERCEL_GIT_PREVIOUS_SHA:-}" ]; then
  exit 1
fi

if ! git cat-file -e "${VERCEL_GIT_PREVIOUS_SHA}^{commit}" 2>/dev/null; then
  exit 1
fi

if [ "$(git rev-parse "$VERCEL_GIT_PREVIOUS_SHA")" = "$(git rev-parse HEAD)" ]; then
  exit 1
fi

# 仅排除不影响 Vercel 播放器产物的顶层目录与文件；其余路径（含新增根文件）默认触发构建。
git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . \
  ':(exclude).dockerignore' \
  ':(exclude).env.example' \
  ':(exclude).github' \
  ':(exclude).gitignore' \
  ':(exclude).omp' \
  ':(exclude).vscode' \
  ':(exclude)AGENTS.md' \
  ':(exclude)CLAUDE.md' \
  ':(exclude)Dockerfile' \
  ':(exclude)LICENSE' \
  ':(exclude)README.md' \
  ':(exclude)docs' \
  ':(exclude)eslint.config.mts' \
  ':(exclude)knip.json' \
  ':(exclude)netlify.toml' \
  ':(exclude)oxfmt.config.mts' \
  ':(exclude)tests' \
  ':(exclude)website'
