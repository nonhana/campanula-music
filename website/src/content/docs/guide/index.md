---
title: 文档目录
description: 浏览 Campanula 的产品介绍、多平台部署方案、日常使用说明与本地开发指南。
tableOfContents: false
sidebar:
  hidden: true
---

## 认识 Campanula

- [功能与边界](../about/features.md) — 界面预览、核心能力、非计划功能与浏览器适配说明。
- [账号安全与数据归属](../about/privacy-and-data.md) — 网易云凭据加密方式、网络流量分流与本地数据存储范围。
- [设计理念](../about/design.md) — 浅色视觉体系、色彩分工、多语种字体与动效演示。

## 部署与运维

- [部署到 Vercel](./vercel.mdx) — 通过 GitHub 与 Vercel 部署并绑定自定义域名。
- [部署到自建服务器](./server.md) — 准备域名与环境变量，配合 Caddy 或 Nginx 配置 HTTPS。
- [Docker 部署](./docker.md) — 从源码构建容器镜像并在自建服务器上运行。
- [Node.js 部署](./node.md) — 使用 Node.js 构建运行并通过 systemd 后台托管。
- [升级与回退](./upgrade.md) — 在保留域名、密钥与本地下载的前提下更新或回退版本。

## 日常使用

- [安装与离线播放](./listen.md) — 安装为独立应用、离线下载、音频导出与常用交互说明。

## 开发与架构

- [本地开发](../development/index.md) — 配置开发环境、本机 HTTPS 证书与 Mock 模式启动流程。
- [架构与实现概览](../development/architecture.md) — 系统分层、请求与媒体分流架构及核心客户端机制。
