---
title: 文档目录
description: 浏览 Campanula 的产品介绍、部署与运维指南、日常使用说明以及本地开发与架构文档。
tableOfContents: false
sidebar:
  hidden: true
---

## 认识 Campanula

- [功能与边界](../about/features.md) — 桌面与手机端界面预览、核心功能清单，以及浏览器支持与交互适配说明。
- [账号安全与数据归属](../about/privacy-and-data.md) — 无数据库架构下的凭据加密方式、业务与媒体流量分流，以及本机数据存储与归属。
- [设计理念](../about/design.mdx) — 浅色视觉体系、可复制语义色板、多语种字体方案与交互动效视频演示。

## 部署与运维

- [部署到 Vercel](./vercel.mdx) — 生成加密密钥，通过 GitHub 部署至 Vercel 并绑定自定义域名。
- [部署到自建服务器](./server.md) — 配置域名与环境变量，配合 Caddy 或 Nginx 反代，通过 Docker 或 Node.js 运行。
- [Docker 部署](./docker.md) — 在自建服务器上从源码构建容器镜像，挂载环境变量并以后台容器方式运行。
- [Node.js 部署](./node.md) — 从源码构建生产产物，通过仓库标准 PM2 配置后台运行并设置开机自启。
- [升级与回退](./upgrade.md) — Vercel、Docker 与 Node.js 实例在保留域名、密钥与本地下载前提下的升级和回退步骤。

## 日常使用

- [安装与离线播放](./listen.md) — 安装为独立应用、离线下载与断网播放验证、音频导出以及常用交互提示。

## 开发与架构

- [本地开发](../development/index.md) — 搭建本地环境，启动真实与 Mock 播放器（含本机 HTTPS 证书）、开发文档站及提交前检查。
- [架构与实现概览](../development/architecture.md) — 系统分层、无状态 API 与媒体直连分流、六项核心客户端机制以及仓库文档索引。
