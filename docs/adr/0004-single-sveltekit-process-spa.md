# 单个 SvelteKit 进程，页面关闭 SSR，大流量由浏览器直连网易云

Campanula 以单个 SvelteKit（adapter-node）进程运行：服务端路由就是 Campanula 自己的 API 层，在进程内直接调用 hana-music-api SDK；页面关闭服务端渲染（SSR），以单页应用（SPA）方式运行。服务器只处理需要凭据的小请求；音频（在线播放和下载）以及上传的歌单封面这类大流量，由浏览器直接和网易云的存储服务器传输，不经过 Campanula 的服务器。网易云的音频服务器和图片上传服务器都允许跨域访问，这一点已经实测过。

## Considered Options

- **页面做 SSR**：对“登录后才能用的个人播放器”几乎没有收益：不需要搜索引擎收录，PWA 外壳本来就能瞬间打开。反而会带来一整类只在服务端渲染时出现的缺陷，前两次尝试都踩过（SSR 期间 `onDestroy` 访问 `document`、`resolve()` 在 SSR 时报 500）。
- **hana-music-api 自带的 Bun HTTP 服务 + SvelteKit 前端，两个进程**：该服务没有鉴权，跨域对任意来源放行，还按来访 IP 限流；所有听众的请求经 SvelteKit 转发后会挤进同一个 IP 的额度。要先改造 hana-music-api 才能用。
