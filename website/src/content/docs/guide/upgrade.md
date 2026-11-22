---
title: 升级与回退
description: 在保留原域名、Cookie 加密密钥与本地下载的前提下完成版本升级或回退。
---

执行升级前，须保留原有的**站点域名、`COOKIE_SECRET` 与 `LOGIN_COOKIE_NAME`**，预先备份环境变量文件并记录当前稳定版本号。离线下载绑定在原设备、原浏览器及原域名下，若计划更换访问域名，建议先[导出已下载音频](./listen.md#下载管理与导出)。

## Vercel 升级与回退

### 升级

1. 在 Vercel 控制台确认项目关联的 GitHub 仓库与 **Production Branch**。
2. 在本地 Bash 的空目录中执行以下命令（将仓库地址与分支名替换为实际值）：

   ```bash
   CAMPANULA_REPO=https://github.com/YOUR_NAME/YOUR_REPO.git
   CAMPANULA_BRANCH=main
   git clone --branch "$CAMPANULA_BRANCH" --single-branch "$CAMPANULA_REPO" campanula-upgrade
   cd campanula-upgrade
   git branch "backup-campanula-$(date +%Y%m%d-%H%M%S)"
   git remote add campanula-upstream https://github.com/nonhana/campanula-music.git
   git fetch campanula-upstream main
   git restore --source campanula-upstream/main --staged --worktree -- .
   git diff --cached
   ```

3. 核对暂存区变更，合回需要保留的自定义修改后提交并推送至自有生产分支：

   ```bash
   git add -A
   git commit -m 'chore: 更新 Campanula 播放器代码'
   git push origin "$CAMPANULA_BRANCH"
   ```

4. 等待 Vercel 构建变为 **Ready** 并通过全部检查，随后核对 **Source**、区域（`hkg1`）及 Production 环境下的原有密钥。

### 回退

进入 Vercel 项目 **Deployments** 列表，找到上一版正常的生产构建记录并执行 **Instant Rollback**（回退自动沿用该部署当时的环境变量）。问题修复后可通过 **Undo Rollback** 恢复自动持续部署（参考 [Vercel 回退说明](https://vercel.com/docs/instant-rollback)）。

## Docker 升级与回退

### 升级

1. 在确认源码工作区无未保存更改后，记录当前运行镜像 ID 以便必要时回退，再拉取最新代码：

   ```bash
   CAMPANULA_OLD_IMAGE=$(docker inspect campanula --format '{{.Image}}') &&
     printf '%s\n' "$CAMPANULA_OLD_IMAGE" > "$HOME/campanula-config/previous-image.txt"
   git pull --ff-only origin main
   ```

2. 按[从源码构建镜像](./docker.md#从源码构建镜像)中的步骤更新 `CAMPANULA_REV=$(git rev-parse HEAD)` 并构建新版镜像。
3. 新镜像构建完成后，执行 `docker stop campanula && docker rm campanula`，再按[启动容器](./docker.md#启动容器)重新创建并启动容器，继续挂载原 `runtime.env`。

### 回退

```bash
CAMPANULA_OLD_IMAGE=$(cat "$HOME/campanula-config/previous-image.txt")
docker image inspect "$CAMPANULA_OLD_IMAGE" --format '{{.Id}}'
```

确认旧版镜像仍存在于本机后，停止并删除新版容器，重新执行[启动容器](./docker.md#启动容器)命令并将镜像参数替换为 `"$CAMPANULA_OLD_IMAGE"`。

## Node.js 升级与回退

### 升级

以原部署用户在服务器执行，目录结构沿用 [Node.js 部署指南](./node.md)。

1. 更新前检查工作区状态并记录当前软链接指向的版本目录，拉取最新代码后核对 `.node-version` 与 `package.json` 中的运行时版本要求：

   ```bash
   cd "$HOME/campanula"
   readlink current > "$HOME/campanula-config/previous-release.txt"
   cd source
   git pull --ff-only origin main
   ```

2. 安装依赖并构建产物，复制至带新提交哈希的独立发布目录：

   ```bash
   pnpm install --frozen-lockfile && env -u VERCEL pnpm build
   ```

   ```bash
   CAMPANULA_REV=$(git rev-parse HEAD)
   mkdir "../releases/$CAMPANULA_REV" &&
     cp -R build package.json "../releases/$CAMPANULA_REV/"
   ```

3. 原子切换 `current` 软链接至新版目录并重启进程：

   ```bash
   cd "$HOME/campanula"
   test -f "releases/$CAMPANULA_REV/build/index.js" &&
     ln -s "releases/$CAMPANULA_REV" current.next &&
     mv -Tf current.next current
   ```

   - 使用 systemd 用户服务时运行 `systemctl --user restart campanula`。
   - 若 Node.js 可执行文件路径发生变化，先同步修改服务文件中的 `ExecStart`，执行 `systemctl --user daemon-reload` 后再重启。
   - 前台运行时通过 Ctrl+C 停止进程，再按[启动服务](./node.md#启动服务)命令重新启动。

### 回退

```bash
cd "$HOME/campanula"
CAMPANULA_OLD_RELEASE=$(cat "$HOME/campanula-config/previous-release.txt")
test -f "$CAMPANULA_OLD_RELEASE/build/index.js" &&
  ln -s "$CAMPANULA_OLD_RELEASE" current.rollback &&
  mv -Tf current.rollback current
```

软链接切换完成后重启 Node.js 服务。若跨度版本涉及浏览器端 IndexedDB 结构变更，回退前应先查阅对应版本发布说明。

## 升级后验证

- 自建服务器实例先行按[验证部署](./server.md#验证部署)确认本地接口与 HTTPS 反代正常。
- 在原设备与常用浏览器中访问原域名，核对登录态是否保持有效，并在「已下载」中抽检一首歌曲的离线播放。
- 若界面仍停留在旧版本外壳，联网访问一次后关闭所有 Campanula 标签页与窗口，再次打开即可启用新版本（无需清理站点数据）。
- 若发生意外掉登，重点核对访问域名、`LOGIN_COOKIE_NAME` 与 `COOKIE_SECRET` 是否一致；若网易云上游会话已过期，重新扫码或短信登录即可恢复。
