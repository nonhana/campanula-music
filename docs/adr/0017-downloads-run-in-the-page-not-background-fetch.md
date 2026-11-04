# 下载只由开着的页面来下，不用 Background Fetch

Spec #11 原来要求“关掉 App 后下载继续、通知栏显示进度”，做法是把一批歌交给浏览器的 Background Fetch。验证关卡③在作者的手机上测通过（#16：一个任务装 6 首，App 划掉后都下完了）。#41 第一轮照这个做法实现后，真机上出现两个现象：通知栏的进度一直在走，实际几乎没有流量；通知栏说下完了，回到 App 页面才从头开始下。作者回滚了这一轮，2026-11-04 定：不用 Background Fetch，下载只由开着的页面来下；队列和断点存进本机，回到 App、重新打开时自动接着下。2026-11-05 文案清理保留这一行为，但不再常驻解释暂停机制或单独提示自动恢复。

不用它的原因。下面的事实来自 Chromium 源码（2026-11-03 读的 `main` 和 Chrome 154 的 `154.0.8037.127` 标签），没有在真机上逐条复现：

- **通知栏不可信。** 任务失败时，Android 通知照样写“下载完成”（[`background_fetch_delegate_impl.cc`](https://github.com/chromium/chromium/blob/main/chrome/browser/background_fetch/background_fetch_delegate_impl.cc) 的 `UpdateOfflineItem`）。Chrome 进程被系统回收后，进度会停在半截（验证关卡③实测）。下载有没有用，要到断网时才知道；“说下完了却没有”比“还没下完”更糟。
- **一处出错，整批白下。** 一批里只要有一个请求不是 2xx，整个任务就算失败。`downloadTotal` 估小了，整个任务会被中止。Chrome 154 在中止时还不发事件：任务一直挂在“进行中”，占着 Chrome 全局仅有的两个下载位，直到 Chrome 重启（[`background_fetch_delegate_base.cc`](https://github.com/chromium/chromium/blob/main/components/background_fetch/background_fetch_delegate_base.cc) 的 `FailFetch`，Chrome 155 的 [9b6e1bf8ee](https://github.com/chromium/chromium/commit/9b6e1bf8ee91534c42bce67cf4b893dfba40a091) 修好）。
- **会弹看不懂的询问。** 同一个页面第二次开任务，要过 Chrome 的“自动下载”限制，会弹出“允许这个网站下载多个文件吗”。页面在后台时弹不出来，`fetch()` 就一直不返回，之后开的任务都排在它后面；听众拒绝过一次，以后就一直被拒（[`download_request_limiter.cc`](https://github.com/chromium/chromium/blob/main/chrome/browser/download/download_request_limiter.cc)）。第一轮遇到的“开任务挂住”和 `This origin does not have permission to start a fetch.`，都是这个限制造成的。
- **结果交给哪个 Service Worker 说不准。** 完成事件只交给当时正在生效的 Service Worker，处理最多 5 分钟，Chrome 崩溃后也不补发（[`background_fetch_event_dispatcher.cc`](https://github.com/chromium/chromium/blob/main/content/browser/background_fetch/background_fetch_event_dispatcher.cc)）。而新版本的 Service Worker 要等 App 全部关掉才接手（ADR-0015），所以部署后第一次打开时，页面已经是新代码，收结果的还是旧的 Service Worker。
- **两套进度。** 交给浏览器的那一批，下载面板里没有逐首进度，只能看通知栏的总进度。
- **几乎没人用。** 2025 年 11 月 Chrome 提议弃用 Background Fetch（使用率不到十万分之二），几天后撤回了，但 API 一直没人维护（[blink-dev 讨论](https://groups.google.com/a/chromium.org/g/blink-dev/c/CpXXaJh5Rq8/)）。公开资料里只找到一个播客 PWA（mozaic.fm）在线上用过它，作者 [2025 年 12 月说不再维护](https://blog.jxck.io/entries/2025-12-08/deprecating-background-fetch.html)。Spotify、YouTube Music 的帮助文档也只写了 App 里的离线下载。

页面自己下时，能撑到什么时候（同样是读源码得出的，没在真机上测）：App 开着时一直下。Android 上，页面切到后台约 1 分钟后会被冻结，下载跟着停；正在出声的页面不冻结，所以放着歌切到后台时会一直下（[`page_scheduler_impl.cc`](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/platform/scheduler/main_thread/page_scheduler_impl.cc)）。划掉 App 后就停了。

## Considered Options

- **以 Background Fetch 为主**（#41 第一轮）：理由见上。
- **只在点“下载”的那一下开一个任务，专门应付 App 被划掉**：能避开一部分坑。点按会重置“自动下载”限制；不给 `downloadTotal`；失败时也逐首存下已经下完的。但通知栏不可信、两套进度、API 前途这三条躲不开，而它多覆盖的只有“手机上切走又没放歌”和“划掉 App”两种情况。
- **在 Service Worker 里下载**：每个事件最多 5 分钟，空闲 30 秒就停，页面关掉后撑不住（[`service_worker_version.h`](https://github.com/chromium/chromium/blob/main/content/browser/service_worker/service_worker_version.h)）。
- **Background Sync、Periodic Background Sync**：一次最多 3 分钟，周期同步最快 12 小时一次，只够补点小东西。
- **下载时保持亮屏（Screen Wake Lock）**：能让“放在桌上等它下完”时页面不被冻结。作者这次没选，以后需要时再单独加。

## Consequences

- 下载要 Campanula 开着才会进行。手机上切到别的 App 约 1 分钟后会暂停（放着歌时不会），划掉 App 就停；回到 App、重新打开时自动接着下。界面只呈现当前进度、暂停和失败，不常驻解释后台机制，也不为正常加入或自动恢复另发成功提示。
- Service Worker 仍然只管外壳（ADR-0015），里面没有下载的代码。服务端也不加“收到请求时再取下载地址、302 跳过去”的接口。
- Spec #11 第 111 条用户故事和“客户端：下载”一节跟着改。验证关卡③“App 划掉后 Background Fetch 能下完”的结论作为记录留在 #16，不再是实现的依据。
- ADR-0009 把 Background Fetch 列为必须用 HTTPS 的原因之一，现在用不到它了；HTTPS 仍然必须（Service Worker、Storage API、带 `Secure` 的 Cookie）。
- 什么时候重新考虑：Chrome 稳定版普遍到 157 以上（`downloadTotal` 的缺陷修好了，跨域规则也改完了），Background Fetch 不再有弃用计划，并且作者实际用下来，经常需要划掉 App 后还接着下。
