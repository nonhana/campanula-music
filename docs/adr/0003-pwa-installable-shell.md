# PWA 离线壳：manifest + service worker + 安装提示

Campanula 需可安装为应用（Android 优先，Spec「PWA」决策）。决策：静态 `manifest.webmanifest` + 手写 `static/sw.js` 离线壳 + 客户端安装提示组件，无新增构建依赖；离线壳策略为应用外壳（导航页面 + 哈希静态资源）网络优先/缓存兜底，`/api` 数据通道与 SvelteKit `__data.json` 预取一律直连不缓存（实时数据 + 凭据敏感）；音频流为跨域请求，SW 不代理，后台播放继续依赖既有 Media Session（Ticket 06）。SW 仅生产构建注册，开发态避免缓存干扰。

考虑过：vite-plugin-pwa（构建期 precache 清单、自动注入）——适配器静态输出与单文件 SW 均可满足，插件引入额外构建复杂度且对 3 个静态文件的收益为零，否决。离线音频缓存——Spec Out of Scope，否决。

已知取舍（记录在案）：iOS Safari 无 `beforeinstallprompt` 支持，安装靠「分享 → 添加到主屏幕」，组件内呈现一次性提示；iOS 后台播放受系统限制，不实现。Android 实机验证（主屏安装、后台播放、锁屏媒体控制）需真机人工执行。