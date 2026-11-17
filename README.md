## Campanula Music

开源的第三方网易云音乐播放器：听众用自己的网易云账号登录，在手机和桌面上听歌、搜歌，把喜欢的音乐收进自己的曲库。可以安装成手机和桌面上的独立 App（PWA），以自部署为主。

当前 v1 在 `rewrite/v1` 开发。部署时明确选择这个分支；仓库默认的 `master` 和旧 GHCR 镜像不代表新版。

- 产品与设计：[PRODUCT.md](./PRODUCT.md)、[DESIGN.md](./DESIGN.md)
- 术语：[GLOSSARY.md](./GLOSSARY.md)
- 架构决策：[docs/adr/](./docs/adr/)

### 部署

先读[部署指南](./website/src/content/docs/guide/index.md)，选择 [Vercel](./website/src/content/docs/guide/vercel.mdx) 或[自己的服务器](./website/src/content/docs/guide/server.md)。服务器可用 [Docker 源码构建](./website/src/content/docs/guide/docker.md)或[直接跑 Node](./website/src/content/docs/guide/node.md)。

部署后看[安装与离线播放](./website/src/content/docs/guide/listen.md)，已有实例更新看[升级与回退](./website/src/content/docs/guide/upgrade.md)。密钥保留原值，下载留在原设备的浏览器里；具体操作与排错都在对应正文。

### 开发

[本地开发指南](./website/src/content/docs/development/index.md)包含 Node/pnpm 版本、真实和 mock 模式、首次证书授权、官网预览及检查命令。旧的 [docs/development.md](./docs/development.md) 和[自部署路径](./docs/self-hosting.md)保留章节入口。

编码代理从 [AGENTS.md](./AGENTS.md) 读取工作约定。

### License

[MIT](./LICENSE)
