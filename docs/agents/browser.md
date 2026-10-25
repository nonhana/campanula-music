# 浏览器验证

一个浏览器进程、一个专用上下文；同一时间只允许一个 agent 操作。日常验证默认走 mock，不需要登录；真账号只给作者做最后的交付试用。

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
```

- 一次性 smoke：`pnpm dev:mock` 开着时跑 `pnpm smoke:mock`（自动登录、同步、打开歌单、写入、刷新、重置）。
- 默认是 mock：会话 `campanula-mock`，profile `~/.cache/campanula-axi/mock-profile`，开发服务器 `http://localhost:5174`（先 `pnpm dev:mock`）。
- 真账号加 `--real`：复用专用浏览器 `scripts/axi.sh`（会话 `campanula`，profile `~/.cache/campanula-axi/chrome-profile`，开发服务器 5173）。不会另开窗口。
- 命令之间用 `~/.cache/campanula-axi/browser.lock` 加文件锁。锁被占时先看持锁的进程；确认它已经停了再删锁，不要并发操作。`sweep.py` 会直接调 DevTools，跑它的时候不要再开另一个 agent 操作同一个浏览器。

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

- 静态 review 不碰浏览器。
- 需要看画面时，由父 agent 用 mock 打开、执行、截图，把结论和截图路径交给 reviewer；reviewer 不再各自启动 Chrome。
- 截图、动效逐帧只在作者点名时做；日常实现者不做成批的浏览器检查（`docs/agents/delivery.md`）。

## 和界面验收 skill 的关系

`campanula-ui-acceptance` 的 `sweep.py` 默认连 mock：`CAMPANULA_BROWSER_ORIGIN` 默认 `http://localhost:5174`，端口用 `scripts/browser.sh port` 拿；要拍真账号时设 `CAMPANULA_BROWSER=real`，并先 `check --real`。mock 下写入是安全的，但截图前仍要按 skill 的拦截规则看清是在拍什么状态。
