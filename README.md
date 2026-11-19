# Campanula Music

开源的第三方网易云音乐播放器，用自己的网易云账号登录，打开就是曲库。

- 在线文档与部署指南：[campanula.caelum.moe](https://campanula.caelum.moe)

## 部署

新版 v1 使用 `rewrite/v1` 分支，源码部署请选择该分支。

| 部署方式     | 指南                                                                                                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel       | [创建项目并绑定域名](./website/src/content/docs/guide/vercel.mdx)                                                                                                           |
| 自己的服务器 | [准备环境和 HTTPS](./website/src/content/docs/guide/server.md)，选 [Docker](./website/src/content/docs/guide/docker.md) 或 [Node](./website/src/content/docs/guide/node.md) |

- [认识 Campanula](./website/src/content/docs/about/features.md) · [账号安全与数据归属](./website/src/content/docs/about/privacy-and-data.md) · [设计理念](./website/src/content/docs/about/design.md)
- [安装与离线播放](./website/src/content/docs/guide/listen.md) · [升级与回退](./website/src/content/docs/guide/upgrade.md)

## 开发与文档

- 用户与开发者公开文档：[本地开发](./website/src/content/docs/development/index.md) · [架构与实现概览](./website/src/content/docs/development/architecture.md)
- 仓库工程规范：[编码代理索引](./AGENTS.md) · [产品与规则](./docs/product/overview.md) · [设计系统](./docs/design/foundations.md) · [架构决策](./docs/adr/)

## 许可证

[MIT](./LICENSE)
