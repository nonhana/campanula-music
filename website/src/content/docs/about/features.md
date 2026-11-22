---
title: 功能与边界
description: Campanula 桌面端与手机端界面预览、核心功能、非计划功能以及浏览器与交互适配规则。
---

Campanula 是一款聚焦听歌主线的第三方网易云音乐播放器，使用听众自己的网易云账号登录后直接进入曲库，不包含推荐广场与商业模块。

## 界面预览

<figure class="showcase-figure">
  <img src="/showcase/desktop-home.webp" alt="Campanula 桌面端曲库首页，展示我喜欢的音乐、每日推荐、自建歌单与收藏的歌单" width="1600" height="1059" />
  <figcaption>桌面端曲库首页：薄荷晨光底色、纸白卡片分区与底部播放控制栏</figcaption>
</figure>

<figure class="showcase-figure">
  <img src="/showcase/desktop-playlist.webp" alt="Campanula 桌面端自建歌单详情页，包含歌单信息、歌曲列表与正在播放行晨光高亮" width="1600" height="1059" />
  <figcaption>桌面端歌单页：左侧固定曲库导航，列表当前播放行铺开浅薄荷晨光进度</figcaption>
</figure>

<figure class="showcase-figure">
  <img src="/showcase/desktop-playing.webp" alt="Campanula 桌面端播放页，展示封面浅雾背景、播放控制与双语歌词" width="1600" height="1051" />
  <figcaption>桌面端播放页：基于当前封面图生成的浅雾背景，配合双语歌词与音译开关</figcaption>
</figure>

<div class="showcase-mobile-grid">
  <figure class="showcase-figure">
    <img src="/showcase/mobile-home.webp" alt="Campanula 手机端我喜欢的音乐曲库列表" width="720" height="1570" />
    <figcaption>手机端曲库列表</figcaption>
  </figure>
  <figure class="showcase-figure">
    <img src="/showcase/mobile-playing.webp" alt="Campanula 手机端播放页，展示封面图与波浪播放进度条" width="720" height="1570" />
    <figcaption>手机端播放与波浪进度</figcaption>
  </figure>
  <figure class="showcase-figure">
    <img src="/showcase/mobile-lyrics.webp" alt="Campanula 手机端全屏双语歌词与翻译开关视图" width="720" height="1570" />
    <figcaption>手机端双语歌词视图</figcaption>
  </figure>
</div>

## 核心功能

| 板块       | 核心能力                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------- |
| 曲库       | 我喜欢的音乐、自建歌单、收藏的歌单/专辑/歌手；本地优先渲染，大歌单列表支持本地即时筛选            |
| 搜索与发现 | 单曲、歌单、歌手、专辑搜索及输入建议、本机搜索历史、每日推荐                                      |
| 播放与歌词 | 播放队列、音质与循环模式切换、逐字/逐行歌词（翻译、音译、选字复制与跳转）、系统媒体控制、听歌打卡 |
| 歌单整理   | 红心、加入歌单、收藏、新建/编辑/删除自建歌单、更换歌单封面、多选操作与拖动排序                    |
| 离线下载   | 单曲/整张歌单/整张专辑下载、断点续传、独立下载音质、按歌单清理以及带元数据导出到文件夹            |

受版权与网易云会员规则限制，无版权歌曲在列表中置灰且不可播放；非会员账号播放会员歌曲时仅返回试听片段，试听片段不支持下载。

## 非计划功能

为保持界面与维护范围收敛，以下功能不在开发计划内：

- **信息流与社交模块**：推荐广场、排行榜、私人 FM、最近播放、热搜榜、评论、动态与私信、MV、播客、云盘、商城、推送通知。
- **重型音频插件**：均衡器、音效增强、淡入淡出、定时关闭、桌面悬浮歌词。
- **多主题与多语言**：仅提供浅色主题与简体中文界面。

## 运行环境与交互

- **推荐浏览器**：Android Chrome、桌面 Chrome 与桌面 Edge（均支持安装为独立应用）；不保证其他浏览器的安装与文件夹导出等增强能力，暂不支持 iOS。
- **响应式与指针适配**：视口宽度窄于 `768px` 时切换为手机布局，`768px` 及以上使用桌面布局；交互细节按实际输入设备切换，例如窄桌面窗口使用鼠标时仍保留右键菜单。

继续了解凭据加密与数据存放边界见[账号安全与数据归属](./privacy-and-data.md)，准备自行部署见[部署指南](../guide/index.md)。
