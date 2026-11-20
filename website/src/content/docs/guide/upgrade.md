---
title: 升级与回退
description: 沿用原域名和密钥，按部署方式更新或回退。
---

升级前保留**原域名、`COOKIE_SECRET` 和 `LOGIN_COOKIE_NAME`**，备份环境文件并记下当前可用版本。下载留在原设备、原浏览器和原域名下，换地址前可先[导出](./listen.md#保存与导出下载)。

## Vercel 升级与回退

### 升级

1. 在 Vercel 项目设置中确认连接的仓库与 **Production Branch**。
2. 在本机 Bash 的空目录执行以下命令，将仓库地址和分支换成自己的。

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

3. 检查差异，把需要保留的自定义配置加回来。有改动时提交并推送到**自己的**生产分支。

   ```bash
   git add -A
   git commit -m 'chore: 更新 Campanula 播放器代码'
   git push origin "$CAMPANULA_BRANCH"
   ```

4. 等部署 **Ready**、项目配置的检查通过，并确认生产域名指向新版。核对 **Source**、`hkg1` 和 Production 的原密钥。

### 回退

在 **Deployments** 选上一次正常的生产部署，使用 **Instant Rollback**。回退沿用目标部署当时的环境变量。修复后用 **Undo Rollback** 切回新版，恢复自动发布。 [Vercel 回退说明](https://vercel.com/docs/instant-rollback)

## Docker 升级与回退

### 升级

1. 记录运行中的镜像 ID，保留旧镜像。以下在服务器的源码目录运行，先确认工作区没有待保留的改动。

   ```bash
   CAMPANULA_OLD_IMAGE=$(docker inspect campanula --format '{{.Image}}') &&
     printf '%s\n' "$CAMPANULA_OLD_IMAGE" > "$HOME/campanula-config/previous-image.txt"
   git pull --ff-only origin main
   ```

2. 按[从 v1 源码构建](./docker.md#从-v1-源码构建)中的 `docker build` 命令构建新版，先用 `CAMPANULA_REV=$(git rev-parse HEAD)` 取新版提交编号。
3. 构建成功后，运行 `docker stop campanula && docker rm campanula`，再按[启动命令](./docker.md#配置并启动)创建新版容器，沿用环境文件和端口。

### 回退

```bash
CAMPANULA_OLD_IMAGE=$(cat "$HOME/campanula-config/previous-image.txt")
docker image inspect "$CAMPANULA_OLD_IMAGE" --format '{{.Id}}'
```

确认旧镜像还在，再停止并删除新版容器，重跑[启动命令](./docker.md#配置并启动)，将镜像参数换成 `"$CAMPANULA_OLD_IMAGE"`。

## Node 升级与回退

### 升级

在服务器以原部署用户操作，目录沿用 [Node 指南](./node.md)。

1. 记录旧版本。在更新源码前检查工作区，拉取后核对新版的 Node 和 pnpm 版本要求。

   ```bash
   cd "$HOME/campanula"
   readlink current > "$HOME/campanula-config/previous-release.txt"
   cd source
   git pull --ff-only origin main
   ```

2. 构建新版，成功后写入独立发布目录。

   ```bash
   pnpm install --frozen-lockfile && env -u VERCEL pnpm build
   ```

   ```bash
   CAMPANULA_REV=$(git rev-parse HEAD)
   mkdir "../releases/$CAMPANULA_REV" &&
     cp -R build package.json "../releases/$CAMPANULA_REV/"
   ```

3. 在 Linux 上将 `current` 切到新版，再重启进程。

   ```bash
   cd "$HOME/campanula"
   test -f "releases/$CAMPANULA_REV/build/index.js" &&
     ln -s "releases/$CAMPANULA_REV" current.next &&
     mv -Tf current.next current
   ```

   - systemd 用户服务运行 `systemctl --user restart campanula`。
   - Node 路径有变时，先修改服务的 `ExecStart`，运行 `systemctl --user daemon-reload`，再重启。
   - 前台进程按 Ctrl+C 停止，再用[原启动命令](./node.md#传入环境并启动)启动。

### 回退

```bash
cd "$HOME/campanula"
CAMPANULA_OLD_RELEASE=$(cat "$HOME/campanula-config/previous-release.txt")
test -f "$CAMPANULA_OLD_RELEASE/build/index.js" &&
  ln -s "$CAMPANULA_OLD_RELEASE" current.rollback &&
  mv -Tf current.rollback current
```

切换成功后重启进程。跨浏览器数据库版本回退前先查对应的版本说明。

## 在原设备上确认

- 自建服务器先[检查接口和 HTTPS](./server.md#打开自己的登录页)。
- 用原设备和浏览器打开原域名，检查登录状态，并播放一首已经下载的歌。
- 还在用旧界面时，联网打开一次，再关闭所有 Campanula 标签页和窗口后重开。保留站点数据。
- 意外退出登录时，核对域名、Cookie 名和密钥。网易云会话过期后需重新登录。
