# 浏览器验证

每种环境一个专用浏览器上下文；同一时间只允许一个 agent 操作。Playwright 附着到现有 mock Chrome，和 axi 共用页面、Cookie、IndexedDB 及文件锁。实现者默认不开浏览器（`docs/agents/delivery.md` 第 3 步）；作者点名的浏览器检查默认走 mock，不需要登录；真账号只给作者做最后的交付试用。

## 工具依赖

先跑 `pnpm install`。axi、Chrome DevTools、Playwright CLI 和 axe-core 都是项目开发依赖，版本固定在 `pnpm-workspace.yaml` 的 test catalog；脚本使用本地版本，不依赖全局安装。

`scripts/axi.sh` 指定本地 DevTools 入口。`/call` 仍是 axi 的内部接口；升级 axi 或 DevTools 后，先跑 `pnpm smoke:mock`，再验证下面的 Playwright attach、trace 和 axe。旧桥接进程会保留启动时的工具版本和 Chrome 参数，升级后先断开 Playwright，再 `scripts/browser.sh stop`、`scripts/browser.sh open /`。

## 命令

```sh
scripts/browser.sh check          # mock：开发服务器和场景；真账号：先查 /api/account
scripts/browser.sh open /path     # mock：自动登录后打开；真账号：先查登录，没登录就停下
scripts/browser.sh exec "location.href"
scripts/browser.sh screenshot _notes/screenshots/x.png
scripts/browser.sh reset          # mock 回到种子
scripts/browser.sh scenario empty-playlist
scripts/browser.sh coverage       # mock 的覆盖报告
scripts/browser.sh offline on|off # 浏览器真的离线 / 恢复
scripts/browser.sh port           # 桥接进程端口（sweep.py 用）
scripts/browser.sh stop           # 停止当前环境的专用浏览器
scripts/browser.sh axe            # 扫描当前 mock 页面，完整报告存进 _notes/accessibility/
```

- 一次性 smoke：`pnpm dev:mock` 开着时跑 `pnpm smoke:mock`（自动登录、同步、打开歌单、写入、刷新、重置）。
- 默认是 mock：会话 `campanula-mock`，profile `~/.cache/campanula-axi/mock-profile`，开发服务器 `http://localhost:5174`（先 `pnpm dev:mock`）。mock 的登录 Cookie 是 `campanula_login_mock`，和真账号的 `campanula_login` 分开；同一个浏览器开两个端口也不会互相顶掉。
- 真账号加 `--real`：复用专用浏览器 `scripts/axi.sh`（会话 `campanula`，profile `~/.cache/campanula-axi/chrome-profile`，开发服务器 5173）。不会另开窗口。
- 命令之间用 `~/.cache/campanula-axi/browser.lock` 加文件锁。锁被占时先看持锁的进程；确认它已经停了再删锁，不要并发操作。`sweep.py` 会直接调 DevTools，跑它的时候不要再开另一个 agent 操作同一个浏览器。

## Playwright：操作与回放

只接 mock。先启动 `pnpm dev:mock`，再：

```sh
scripts/browser.sh open /
scripts/playwright.sh attach
scripts/playwright.sh snapshot
scripts/playwright.sh tracing-start
scripts/playwright.sh goto http://localhost:5174/playlists/900000024
scripts/playwright.sh tracing-stop
scripts/playwright.sh detach
scripts/playwright.sh show-trace _notes/playwright/traces
```

`scripts/playwright.sh` 通过同一个文件锁调用项目里的 `playwright-cli`，固定会话 `campanula-mock`。attach 从 mock profile 的 `DevToolsActivePort` 读取本机随机 CDP 端口；旧 Chrome 没有这个文件时按「工具依赖」重启 mock。配置在 `.playwright/cli.config.json`，快照、日志和 trace 都存在 `_notes/playwright/`，不进 git。

Vite 的文件监听排除了 `_notes/`：trace 会生成 HTML 资源，监听这些文件会在录制中意外刷新 App。新增诊断输出也放在这个目录下。

- 用最新 snapshot 里的引用做 click、fill、drag；换页或界面明显改变后重新取 snapshot。`scripts/playwright.sh <命令> --help` 查看当前版本的参数。
- attach 不换页、不重新登录；用 `tab-list` 确认当前标签，必要时 `tab-select <编号>` 选择目标页。
- trace 开始后再执行要记录的导航和操作。结束时 CLI 打印 trace、network 和 resources 的路径；`show-trace` 可打开整个 traces 目录，也可传某一份 `.trace`。查看器用同一份 CLI 依赖里的 Playwright，只读录制文件，不持有 App 浏览器的操作锁。
- 用 detach 结束 Playwright 操作，Chrome 留给 axi 和 sweep 继续用；关闭浏览器用 `scripts/browser.sh stop`。始终通过仓库脚本串行操作。

## axe：无障碍扫描

打开目标 mock 页面，等加载结束；菜单、弹窗等要先打开再扫描：

```sh
scripts/browser.sh axe _notes/accessibility/library.json
```

引擎从项目里的 `axe-core/axe.min.js` 注入，不通过 CDN 加载，也不进入产品代码或生产包。检查 WCAG 2 A/AA、2.1 A/AA、2.2 AA 和 best-practice。终端只列摘要，完整 JSON 包含规则、受影响元素、原因和帮助链接。

退出码 1 表示发现 violations；扫描执行失败也会明确报错。`incomplete` 表示引擎拿不准、需要人工确认，不能写成通过。一次扫描只覆盖当前可见状态；焦点顺序、键盘能否完成操作、读屏是否好理解还要实际操作验证。

## 性能、动效与 PWA

量帧时间、长任务和检查离线外壳时用生产构建：`pnpm build` 后 `pnpm preview`。开发模式的检查会影响性能，开发服务器也不注册 Service Worker 外壳缓存。mock 用来复现页面和数据状态，不能据此宣称生产 PWA 已通过。

动效逐帧只证明采样时刻的画面；卡顿分析要录实际运行的 performance trace。当前 DevTools 的 `emulate.prefersReducedMotion` 会同时影响浏览器的 CSS 媒体查询和 `matchMedia`，sweep 用它设置减少动态效果；每次 emulate 会替换此前的模拟参数，所以视口、减少动态效果和慢网要一起传。手机视口和 CPU/网络降速仍是桌面模拟；系统返回、软键盘、后台与锁屏播放由 Android 真机确认。

## 登录态

- 登录态保存在专用 Chrome profile `~/.cache/campanula-axi/chrome-profile` 里，`scripts/axi.sh` 和 `scripts/browser.sh --real` 用的是同一个会话、同一个 profile。
- `_notes/campanula-login` **只给录制脚本用**（`scripts/take-login.mts` 从专用窗口取一份 Cookie 快照，`scripts/netease-record.mts` 读它）。`scripts/browser.sh` 和 `scripts/axi.sh` 不读这个文件；它过期或被删，不会把专用浏览器的登录弄丢。
- 复用登录态依赖三件事：同一个 profile、`.env` 里同一个 `COOKIE_SECRET`、网易云的 `MUSIC_U` 还没过期。换了 secret 或网易云会话过期，`check --real` 会返回 `account:null`，这时只需在专用窗口扫码一次。
- 新会话：`scripts/browser.sh check --real` 发现 Chrome 没开时，会用同一个 profile 重新启动，不需要重新扫码；已在浏览器进程重启后验证过。

## 真账号

1. 先 `scripts/browser.sh check --real`。
2. 没登录（`/api/account` 不是账号）就停下，请作者在专用窗口（`scripts/axi.sh`）里扫码一次；**不继续打开新页面、不反复重开**。
3. 登录了才 `scripts/browser.sh open --real /path`。
4. 真账号会真的写入网易云。按 Spec #11「交付方式」：只在临时新建、测完即删的歌单上做写操作；不要动作者已有的歌单排序和批量移除。

## reviewer

reviewer 只看 diff，不碰浏览器。截图、动效逐帧、浏览器检查只在作者点名时做（`docs/agents/delivery.md` 第 3 步）。

## 和界面验收 skill 的关系

`campanula-ui-acceptance` 的 `sweep.py` 默认连 mock：`CAMPANULA_BROWSER_ORIGIN` 默认 `http://localhost:5174`，端口用 `scripts/browser.sh port` 拿；要拍真账号时设 `CAMPANULA_BROWSER=real`，并先 `check --real`。mock 下写入是安全的，但截图前仍要按 skill 的拦截规则看清是在拍什么状态。
