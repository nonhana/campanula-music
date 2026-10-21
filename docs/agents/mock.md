# Mock 开发环境

日常界面、动效和 reviewer 验证走这里，不用登录真实网易云；真账号只留给作者最后的交付试用。

## 启动

```sh
pnpm dev:mock
pnpm smoke:mock   # 另开一个终端，跑一次浏览器 smoke（登录、同步、打开歌单、写入、刷新、重置）
```

- 独立端口 `http://localhost:5174`，和普通的 `pnpm dev`（5173，真账号）同时开着也不冲突。
- 打开页面时先走一次自动登录：`http://localhost:5174/mock/login`（`scripts/browser open /` 会自动带上）。登录走的是 App 真实的加密 Cookie 流程，只是凭据是 mock 的。
- 页面左下角显示 `Mock · 测试数据`。
- 退出登录后，UI 的扫码 / 短信登录流程照常可用；mock 的二维码会直接成功。要回到已登录，再访问一次 `/mock/login`。

## 数据

种子来自 `tests/fixtures/netease/` 里已经脱敏、脱敏检查过的录制，和测试用同一批文件、同一个 `index.json` 索引（`pnpm fixtures:index` 生成）。

| 场景里的种子 | 内容 |
|---|---|
| `default`（`before`） | 54 张录制歌单 + 1 张 mock 专用的 4 首可播放歌单、4,984 首我喜欢的音乐、poems 2 首 |
| `after` | poems 3 首（before 的两首 + after 录制里新加的一首） |
| `deleted` | poems 不在歌单列表里，直接打开详情 `status` 是 10 |

- 4 首可播放歌单编号 `900000024`，名字 `Mock · 4 首可播放`，四首歌都在 `playback/liked/` 里录到过完整播放地址。
- 我喜欢的音乐编号 `900000001`；poems 编号 `900000019`。
- 写入（拖拽排序、加歌/移除、新建/删除/改名/简介/标签/隐私/封面、红心、收藏）改的是服务端内存里的同一份状态，刷新页面、重新打开歌单都能看到；`reset` 回到种子。
- 封面、头像、歌曲音频、图片直传都指向开发服务器自己：`/mock-assets/cover/*.svg`、`/mock-assets/audio/*.wav`、`/mock-assets/uploads/*`。mock 环境不会向网易云或其他外网发请求。
- 下载（#38）的地址同样是 `/mock-assets/audio/*.wav`，封面缩略图是本地的 SVG。下载存在浏览器的本机数据库里（属于设备），`reset` 不清它；要回到没有下载，在 DevTools 的 Application 面板删掉 IndexedDB 里的 `campanula`，或者在已下载页逐首删除。

## 场景

```sh
scripts/browser scenario login-expired
scripts/browser scenario rate-limited
scripts/browser reset          # 回到 default
scripts/browser coverage       # 看 mock 调过哪些模块、缺哪些录制
```

| 场景 | 看到什么 |
|---|---|
| `default` / `after` / `deleted` | 换种子，见上表 |
| `login-expired` | 打开 App 显示“需要重新登录”，红心同步回 401 |
| `rate-limited` | 曲库同步的第一步回 405“操作过于频繁”，写入也一样 |
| `deleted-playlist` | poems 从歌单列表里消失；直接打开详情是已删除 |
| `empty-playlist` | poems 是 0 首 |
| `partial-sync` | 第二次取歌曲信息失败，曲库停在同步了一半 |
| `slow` | 每次网易云调用晚 800ms，看骨架和加载状态 |
| `offline` | API 回 503（连不上）；要看真正的断网，用 `scripts/browser offline on` |

场景只影响 mock，不改 App 代码。自定义参数可以直接 `POST /api/mock/scenario`，例如 `{"name":"slow","latencyMs":2000}`。

## 没覆盖的模块

mock 只回答录制里有的模块和查询。遇到没覆盖的调用会明确失败，服务端日志写清模块、查询、场景，`GET /api/mock/coverage`（或 `scripts/browser coverage`）的 `misses` 里也有一条；不会静默回退到真账号。

要补：按 `tests/fixtures/netease/README.md`「录制」用 `scripts/netease-record.mts` 录，再跑 `pnpm fixtures:index`。

### 缺数据怎么处理

先跑一遍要做的界面，让 mock 报错，`scripts/browser coverage` 会给出模块、查询、场景。按缺的东西分：

| 缺什么 | 怎么做 |
|---|---|
| 整个模块没录过（新接口） | 先确认 `hana-music-api` 的类型里声明了这个模块（ADR-0005）；没有就先更新 SDK。再用一次性录制脚本只读录 1 次，过索引校验，mock 加 handler；有状态的加进 seed/store。 |
| 同模块的新查询（新歌单/新分页/新关键词） | 只录这一个查询；索引按模块 + 查询匹配。歌单、红心、搜索这类有状态的最好补进 seed/store 生成，而不是堆原始录制。 |
| 同模块已有录制，但缺新字段/结构变了 | 先更新 SDK 结构定义，再用当前 SDK 重录；不要手改旧录制来假装新结构。可选字段不影响行为就不补。 |
| 失败/边界（限流、已删除、8821、二维码成功） | 能录到真实失败就录；录不到（比如限流不一定复现）才构造。构造要作者同意，文件名带 `.constructed`，`context.constructed: true`，写清依据，过 SDK 校验；真遇到时替换成录制。 |
| 封面、音频、图片直传 | 不录制，mock 本地生成/保存；保证返回体里的外网地址都被本地化。 |

录制前先 `pnpm tsx scripts/take-login.mts` 刷新 `_notes/campanula-login`。它只是录制用的快照，不影响浏览器登录；`openSession()` 会先只读查一次 `user_account`，登录失效就停下请作者扫码。写操作只在临时新建的隐私歌单上做，做完删掉（Spec #11 交付方式第 1 条）。

录完跑 `pnpm fixtures:index`：每份录制都过 SDK 结构定义；没有结构的模块记 `validated: false`，mock 不拿它回答。最后补/跑对应测试，界面相关的再跑 `pnpm smoke:mock`。

## 限制

- 状态在 mock 进程的内存里：重启 `dev:mock` 回到种子。
- 只覆盖录制到的曲库内容。专辑页、歌手页只覆盖录到的那几张；歌词只覆盖录到的几首。
- 二维码成功、短信登录、写操作限流这些 mock 场景的返回是构造的，不写成录制文件；真遇到时替换成录制。
- 这不替代测试：App 测试仍然走 `tests/harness/world.ts` 的精确队列；mock 是给开发服务器和浏览器用的消费者。
