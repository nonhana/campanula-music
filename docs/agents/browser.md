# 浏览器验证

一个浏览器进程、一个专用上下文；同一时间只允许一个 agent 操作。日常验证默认走 mock，不需要登录；真账号只给作者做最后的交付试用。

## 命令

```sh
scripts/browser check          # mock：开发服务器和场景；真账号：先查 /api/account
scripts/browser open /path     # mock：自动登录后打开；真账号：先查登录，没登录就停下
scripts/browser exec "location.href"
scripts/browser screenshot _notes/screenshots/x.png
scripts/browser reset          # mock 回到种子
scripts/browser scenario empty-playlist
scripts/browser coverage       # mock 的覆盖报告
scripts/browser offline on|off # 浏览器真的离线 / 恢复
scripts/browser port           # 桥接进程端口（sweep.py 用）
```

- 一次性 smoke：`pnpm dev:mock` 开着时跑 `pnpm smoke:mock`（自动登录、同步、打开歌单、写入、刷新、重置）。
- 默认是 mock：会话 `campanula-mock`，profile `~/.cache/campanula-axi/mock-profile`，开发服务器 `http://localhost:5174`（先 `pnpm dev:mock`）。
- 真账号加 `--real`：复用专用浏览器 `scripts/axi`（会话 `campanula`，profile `~/.cache/campanula-axi/chrome-profile`，开发服务器 5173）。不会另开窗口。
- 命令用 `~/.cache/campanula-axi/browser.lock` 加文件锁。锁被占时先看持锁的进程；确认它已经停了再删锁，不要并发操作。`sweep.py` 会直接调 DevTools，跑它的时候不要再开另一个 agent 操作同一个浏览器。

## 真账号

1. 先 `scripts/browser check --real`。
2. 没登录（`/api/account` 不是账号）就停下，请作者在专用窗口（`scripts/axi`）里扫码一次；**不继续打开新页面、不反复重开**。
3. 登录了才 `scripts/browser open --real /path`。
4. 真账号会真的写入网易云。按 Spec #11「交付方式」：只在临时新建、测完即删的歌单上做写操作；不要动作者已有的歌单排序和批量移除。

## reviewer

- 静态 review 不碰浏览器。
- 需要看画面时，由父 agent 用 mock 打开、执行、截图，把结论和截图路径交给 reviewer；reviewer 不再各自启动 Chrome。
- 截图、动效逐帧只在作者点名时做；日常实现者不做成批的浏览器检查（`docs/agents/delivery.md`）。

## 和界面验收 skill 的关系

`campanula-ui-acceptance` 的 `sweep.py` 默认连 mock：`CAMPANULA_BROWSER_ORIGIN` 默认 `http://localhost:5174`，端口用 `scripts/browser port` 拿；要拍真账号时设 `CAMPANULA_BROWSER=real`，并先 `check --real`。mock 下写入是安全的，但截图前仍要按 skill 的拦截规则看清是在拍什么状态。
