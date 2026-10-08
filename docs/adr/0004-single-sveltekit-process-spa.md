# 单个 SvelteKit 项目，页面关闭 SSR，大流量由浏览器直连网易云

Campanula 是单个 SvelteKit 项目：服务端路由就是 Campanula 自己的 API 层，在同一个项目里直接调用 hana-music-api SDK；页面关闭服务端渲染（SSR），以单页应用（SPA）方式运行。部署时按平台换适配器（ADR-0009）：在自己的服务器上是一个 Node 进程（`adapter-node`），在 Vercel 上是一个项目，服务端路由变成云函数（`adapter-vercel`）。服务器只处理需要凭据的小请求；音频（在线播放和下载）以及上传的歌单封面这类大流量，由浏览器直接和网易云的存储服务器传输，不经过 Campanula 的服务器。网易云的音频服务器和图片上传服务器都允许跨域访问，这一点已经实测过。

## Considered Options

- **页面做 SSR**：对“登录后才能用的个人播放器”几乎没有收益：不需要搜索引擎收录，PWA 外壳本来就能瞬间打开。反而会带来一整类只在服务端渲染时出现的缺陷，前两次尝试都踩过（SSR 期间 `onDestroy` 访问 `document`、`resolve()` 在 SSR 时报 500）。
- **hana-music-api 自带的 Bun HTTP 服务 + SvelteKit 前端，两个进程**：该服务没有鉴权，跨域对任意来源放行，还按来访 IP 限流；所有听众的请求经 SvelteKit 转发后会挤进同一个 IP 的额度。要先改造 hana-music-api 才能用。
- **静态前端 + 单独部署的 API（YesPlayMusic 的做法）**：网页是纯静态文件，网易云 API 另外部署一份。YesPlayMusic 把 `MUSIC_U` 明文存在页面脚本能读到的 `document.cookie` 和 `localStorage` 里，跨域时还放进 URL 查询参数，凭据会进日志；部署的人也要维护两份东西。

## Consequences

- 部署的人只要部署一个项目：自己的服务器上跑一个进程，Vercel 上导入一个仓库。
