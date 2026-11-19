---
title: 架构与实现概览
description: Campanula 的技术分层、本地优先同步、不断播方案与离线测试体系。
---

本页概述 Campanula 的工程设计，便于希望二次开发或参与贡献的开发者快速建立全局心智模型。本地启动命令见[本地开发](./index.md)。

## 单体 SPA 与无状态接口

Campanula 是单个 Svelte 5 + SvelteKit 项目：页面关闭服务端渲染（SSR），以 SPA / PWA 运行；服务端只提供 `src/routes/api/**/+server.ts` 轻量接口层，在进程内直接按领域调用独立发布的 [`hana-music-api`](https://github.com/nonhana/hana-music-api) SDK。

- **按平台切适配器**：在 Vercel 上通过 `@sveltejs/adapter-vercel` 部署到香港区域（`hkg1`）；在自建服务器上通过 `@sveltejs/adapter-node` 以单进程运行。
- **编译期契约配对**：前后端共用 `src/lib/api/` 端点目录，组件层不直接请求服务端，一律经去 UI 化的完整客户端核心 `src/lib/app/` 驱动状态与请求。
- **无状态与直连媒体**：服务端不保存会话，靠加密 `httpOnly` Cookie 解密鉴权；音频与封面上传等大流量由浏览器直连网易云。

## 本地优先与真机体验方案

- **IndexedDB 本地优先**：打开应用立即渲染本地曲库副本并在后台增量同步；大歌单内搜索全部本地即时完成；写操作乐观更新、失败回滚，并通过前台优先与后台限速队列避免同步阻塞切歌。
- **双 `<audio>` 交替不断播**：播放当前歌曲时由空闲 `<audio>` 预缓冲下一首并在结束前接力起播，避免 Android Chrome 切歌瞬间交出音频焦点导致锁屏或后台停播。
- **页面内下载与断点续传**：下载由打开中的页面流式写入本机存储并持久化断点，重开页面自动续传，避开浏览器 Background Fetch 的误报与整批失败缺陷；导出时在浏览器侧写入 MP3/FLAC 标签、封面与歌词。
- **PWA 外壳延迟更新**：Service Worker 仅缓存应用外壳，新版本延后到下次打开生效，不打断正在播放的歌曲。

## 隔离开发与分层测试

- **双 HTTPS 隔离开发**：`scripts/dev.mts` 统一管理真实（`local.campanula.test:8443`）与 Mock（`mock.campanula.test:8444`）双主机，按主机隔离 Cookie 与独立工作根；mock 层从产品构建外部装配，发布门禁校验生产包零泄露。
- **按证据分层验证**：离线测试覆盖纯规则单测（`unit`）、经真实本机 HTTP 与独立 SSR 的脱敏录制行为测试（`behavior`）、API/SDK 合同自检（`contract`）、环境与生产 PWA 验证（`delivery`），以及独立 Chromium 交互与 axe 零违规门禁（`browser` / `website`）。

## 深入仓库文档

参与改动或使用编码代理时，从仓库根目录的 `AGENTS.md` 入口按需阅读 [仓库 `docs/` 目录](https://github.com/nonhana/campanula-music/tree/master/docs)（含 `agents/`、`product/`、`design/` 与 `adr/`）。
