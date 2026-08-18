# 单进程自托管：adapter-node + SDK 直入

Campanula 定位为可自部署的个人第三方网易云播放器（单实例 = 单用户 = 部署者自己的账号）。决策：以 `@sveltejs/adapter-node` 为唯一部署形态并随仓库提供 Dockerfile，放弃 Netlify Functions；`hana-music-api` 作为 npm SDK 直入应用进程调用，而非独立部署成另一个服务。理由：自部署的部署摩擦最小化——克隆后一条命令即可运行；且 Netlify Functions 运行时文件系统不可写，无法承载扫码绑定的 cookie 持久化。

考虑过：独立部署 hana-music-api 为 Bun 服务再由应用 HTTP 调用（双进程，cookie 集中管理）——对单用户个人软件没有收益，却让部署者维护两个服务；SDK 直入 Netlify Functions、cookie 存云数据库——把绑定流程绑死在云端存储上，违背自部署的初衷。两者均否决。