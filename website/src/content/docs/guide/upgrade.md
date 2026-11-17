---
title: 升级与回退
description: 保留域名、密钥和旧版本，再按部署方式更新播放器。
---

先记下当前正常工作的版本和回退办法，再更新程序。升级沿用**同一个播放器域名、同一把 `COOKIE_SECRET`、相同的登录 Cookie 名**。备份环境文件到自己的安全位置，不要把它提交到仓库。

## 哪些数据在哪里

网易云账号中的歌单、红心等内容在网易云；Campanula 在当前浏览器保存曲库副本，联网后再同步。主动退出会清掉账号的本机曲库副本，换账号也不会沿用前一个账号的副本。

播放队列、偏好和下载保存在这台设备当前浏览器的站点存储里。下载的音频、封面和歌词不放在 Campanula 服务器上，退出或换账号也不会删除，使用这台设备的人仍能访问它们。服务器没有一份可供恢复下载的用户数据库。

同域名、同浏览器下替换服务器程序不会主动清除这些本机数据。换域名、换浏览器或清理站点数据，都不会自动把原来的下载搬过去；浏览器或系统清理存储也可能使其丢失。需要留成普通文件的下载，可以先在支持导出的浏览器里[导出到自己选的文件夹](./listen.md#保存与导出下载)。程序回退也不会回退浏览器数据库，跨越数据库结构变化前应先看对应版本说明，不能保证任意旧版本都能读新数据。

## Vercel 升级与回退

先在自己 Vercel 项目的 **Settings → Git** 记下连接的仓库和 **Production Branch**。手动 Fork 路线应是 `rewrite/v1`；一键复制仓库的生产分支可能叫 `main`，以自己项目的实际设置为准。仅点 Redeploy 会重建原代码，不会从上游取得新版。

下面的方法同时适用于 Fork 和一键复制的仓库，不要求两个仓库有共同提交历史。在**自己的电脑、Bash 终端的空目录**执行：把 `YOUR_NAME/YOUR_REPO` 换成自己的仓库；把 `CAMPANULA_BRANCH` 的值换成刚记下的生产分支，不要照原仓库默认分支填旧 `master`。

```bash
CAMPANULA_REPO=https://github.com/YOUR_NAME/YOUR_REPO.git
CAMPANULA_BRANCH=rewrite/v1
git clone --branch "$CAMPANULA_BRANCH" --single-branch "$CAMPANULA_REPO" campanula-upgrade
cd campanula-upgrade
CAMPANULA_BACKUP=backup-campanula-$(date +%Y%m%d-%H%M%S)
git branch "$CAMPANULA_BACKUP"
git remote add campanula-upstream https://github.com/nonhana/campanula-music.git
git fetch campanula-upstream rewrite/v1
git rev-parse campanula-upstream/rewrite/v1
git restore --source campanula-upstream/rewrite/v1 --staged --worktree -- .
git diff --cached --stat
git diff --cached
```

记下输出的上游完整提交编号。这一步会把新克隆目录里的跟踪文件替换成新版，旧代码仍在备份分支和自己的提交历史中，不会动 Vercel 里保存的密钥和域名。逐项检查差异：自己改过的函数地区或其他代码配置，需要先从备份分支对照，把仍需要的修改重新加到新版并暂存，不能直接推掉自己的配置。没有自定义代码时，文件应与取回的上游版本一致。

确认后仍在这个目录执行；差异为空说明已是同一份代码，无须重复提交：

```bash
git add -A
git commit -m 'chore: 更新 Campanula 播放器代码'
git push origin "$CAMPANULA_BRANCH"
```

推送的是自己的生产分支，会触发新部署。没有仓库写权限或 GitHub 拒绝直接推送时，先修复权限，或按自己仓库规则提交 PR 并合入这个生产分支，不要改推到原项目仓库。

在 **Settings → Environment Variables** 确认 Production 仍使用原密钥。等待新部署 Ready，核对 Source 和函数地区 `hkg1`，再在原域名打开检查。若项目配置了 Deployment Checks，还要等这些检查通过并确认生产域名已指向本次部署，Ready 本身不代表完成切换。

出问题时，在 **Deployments** 找到上一次正常的生产部署，按菜单中的 **Instant Rollback** 或 **Rollback** 检查域名和目标后确认。可用范围及限制以 [Vercel 的回退说明](https://vercel.com/docs/instant-rollback)为准。它恢复旧部署的代码与配置，不会把你刚改的环境变量自动应用到旧部署；缺密钥时应先修项目变量并重新部署，不要期待回退替你修密钥。也把自己仓库的错误修改撤回，避免下一次自动部署又带回来。

## Docker 升级与回退

下面在**服务器**执行，沿用[从源码构建](./docker.md#从-v1-源码构建)的本机镜像。先记录运行中旧镜像，保存到当前用户的配置目录：

```bash
mkdir -p "$HOME/campanula-config"
CAMPANULA_OLD_IMAGE=$(docker inspect campanula --format '{{.Image}}')
printf '%s\n' "$CAMPANULA_OLD_IMAGE" > "$HOME/campanula-config/previous-image.txt"
cd /path/to/campanula-source
```

`/path/to/campanula-source` 换成首次克隆源码的实际绝对路径。确认源码没有自己的未提交修改后，取新版并先构建，旧容器此时继续运行：

```bash
git status --short
git pull --ff-only origin rewrite/v1
CAMPANULA_REV=$(git rev-parse HEAD)
docker build --pull \
  --label "org.opencontainers.image.revision=$CAMPANULA_REV" \
  --tag "campanula-local:$CAMPANULA_REV" .
```

构建成功后才停止旧容器，用原环境文件和本机端口创建新版：

```bash
docker stop campanula
docker rm campanula
docker run -d \
  --name campanula \
  --restart unless-stopped \
  --env-file "$HOME/campanula-config/runtime.env" \
  -p 127.0.0.1:3000:3000 \
  "campanula-local:$CAMPANULA_REV"
curl -i http://127.0.0.1:3000/api/account
```

新版本异常时，先看 `docker logs campanula`。需要回退时，读取刚记录的旧镜像，再停止并删除新版容器，按同一组 `docker run` 参数创建容器，只把最后的镜像换为 `"$CAMPANULA_OLD_IMAGE"`：

```bash
CAMPANULA_OLD_IMAGE=$(cat "$HOME/campanula-config/previous-image.txt")
docker image inspect "$CAMPANULA_OLD_IMAGE" --format '{{.Id}}'
```

必须先确认旧镜像仍在，再做切换。不要在验收新版前执行镜像清理。以后用 GHCR 时同理：先拉取核对过的新版 digest，保留旧 digest 和本机镜像，再替换容器；不要依赖会变动的 `latest` 回退。

## Node 升级与回退

下面在**服务器、原来的部署用户下**执行，目录沿用 [Node 篇](./node.md)。先留下当前发布目录，再在源码目录构建：

```bash
cd "$HOME/campanula"
readlink current > "$HOME/campanula-config/previous-release.txt"
cd source
git status --short
git pull --ff-only origin rewrite/v1
pnpm install --frozen-lockfile
env -u VERCEL pnpm build
CAMPANULA_REV=$(git rev-parse HEAD)
mkdir "../releases/$CAMPANULA_REV"
cp -R build package.json "../releases/$CAMPANULA_REV/"
cd ..
```

开始前确认 `git status` 没有自己的修改，并核对新版声明的 Node、pnpm 是否变化。`mkdir` 提示目录已存在时，先核对是不是同一版，不能覆盖仍在使用的发布目录。

上述操作全部成功后，在 Linux 上切换链接并重启用户服务：

```bash
ln -s "releases/$CAMPANULA_REV" current.next
mv -Tf current.next current
systemctl --user restart campanula
systemctl --user status campanula
curl -i http://127.0.0.1:3000/api/account
```

如果使用前台进程或其他管理器，停止旧进程后用原启动命令重开。环境文件、代理与域名保持不变。回退时先确认旧发布目录还在，再执行：

```bash
cd "$HOME/campanula"
CAMPANULA_OLD_RELEASE=$(cat "$HOME/campanula-config/previous-release.txt")
test -f "$CAMPANULA_OLD_RELEASE/build/index.js"
ln -s "$CAMPANULA_OLD_RELEASE" current.rollback
mv -Tf current.rollback current
systemctl --user restart campanula
```

这里的 `mv -T` 是 Linux 用法。若升级过 Node 并改变了可执行文件路径，还要更新用户服务的 `ExecStart`，执行 `systemctl --user daemon-reload`，再重启。

## 在原设备上确认

先在服务器确认接口响应，再在**升级前用过的同一台设备、同一个浏览器和域名**检查。保持原登录时应不因升级额外要求登录；队列与下载仍应可见，已完成的下载应能播放。网易云会话本身过期时仍需要重新登录，保留密钥不能延长上游会话。

已打开的页面不会被更新强行刷新。新外壳准备好后，要等所有 Campanula 标签页和独立窗口都关闭再重新打开，才会接手；若第一次重开后仍是旧外壳，先联网等新外壳安装完成，再关完重开。不要通过清理站点数据强求更新。

升级后若突然要重新登录，先核对原密钥、Cookie 名与域名；旧 Cookie 尚未被清除时换回原密钥可能恢复，但一旦旧 Cookie 已被新请求清掉或覆盖，就需要重新登录。下载不应因此消失，先回原浏览器与原域名查，不要继续清理存储。
