# Mock 场景、脱敏录制与 SDK 接缝

启动与工作根规则见 [build-and-dev.md](./build-and-dev.md)；自动化浏览器验证见 [browser.md](./browser.md)。本文件仅说明 mock 数据、诊断场景与录制维护。

## 预置种子与状态

种子来自 `tests/fixtures/netease/` 中经结构校验的脱敏录制，索引由 `pnpm fixtures:index` 生成。

| 种子名               | 内容                                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default`（`small`） | 构造小曲库：3 张歌单（我喜欢 `900000001`、poems `900000019`、`Mock · 4 首可播放` `900000024`）、6 首歌、1 张专辑（`3149073`）、1 位歌手（`33927412`），所有声明收藏可完整导航 |
| `large`（`before`）  | 54 张录制歌单 + 4 首可播放歌单、4,984 首红心，用于规模与分页（不保证全部收藏都有详情）                                                                                        |
| `after`              | poems 3 首（before 2 首 + after 新增 1 首）                                                                                                                                   |
| `deleted`            | poems 不在歌单列表，直接打开详情返回 `status: 10`                                                                                                                             |

- 写操作改动内存态，刷新可见；重启 `dev:mock` 或调 `reset` 回种子。
- 封面、头像、音频、上传均指向本地 `/mock-assets/*`，不发任何外网请求。
- 下载保存在浏览器 IndexedDB（属于设备），`reset` 不清除；如需重置，在已下载页删除或清除站点 IndexedDB `campanula`。mock 音频为本地 WAV、封面为 SVG，真实 MP3/FLAC 导出校验以 `tests/unit/song-info-core.test.ts` 与真账号试用为准。

## 运行时场景切换

```sh
curl -k -X POST https://mock.campanula.test:8444/api/mock/scenario \
  -H 'content-type: application/json' -d '{"name":"login-expired"}'
curl -k -X POST https://mock.campanula.test:8444/api/mock/reset
curl -k https://mock.campanula.test:8444/api/mock/coverage
```

| 场景 `name`                                        | 效果                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| `default` / `large` / `after` / `deleted`          | 切换曲库种子                                                            |
| `login-expired`                                    | 打开 App 提示需要重新登录，红心同步返回 401                             |
| `rate-limited`                                     | 同步首步与写操作返回 405 操作过于频繁                                   |
| `deleted-playlist` / `empty-playlist`              | poems 被删或为空                                                        |
| `partial-sync`                                     | 第二次取歌曲信息失败，曲库停在部分同步                                  |
| `slow`                                             | 每次上游调用延迟（默认 800ms，可传 `{"name":"slow","latencyMs":2000}`） |
| `offline`                                          | API 回 503（真实离线请用 Playwright `context.setOffline(true)`）        |
| `qr-confirm` / `qr-expired`                        | 扫码 801→802→803 或 801→800 诊断                                        |
| `empty-search` / `tracks-512` / `missing-relation` | 合法空搜索、写入 512 回退、缺失专辑关系诊断                             |

## 缺数据与录制维护

mock 遇到未覆盖的模块或查询时明确失败并记入 `GET /api/mock/coverage` 的 `misses`，绝不回退真实网易云。按缺口类型处理：

| 缺口类型                        | 处理方式                                                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 新模块未录过                    | 先核对 `hana-music-api` 类型声明（[ADR-0005](../adr/0005-hana-music-api-co-evolution.md)），缺失先修 SDK；用 `tests/tools/netease-record.mts` 只读录制 1 次并过索引校验，再补 handler/store |
| 同模块新查询                    | 录制该查询；有状态模块优先在 seed/store 合成，避免堆砌重复原始文件                                                                                                                          |
| 已有录制缺新字段/改结构         | 先升 SDK 定义，再用当前 SDK 重录；禁止手改旧录制冒充新结构                                                                                                                                  |
| 失败/边界（限流、8821、512 等） | 能录真实失败则录；无法稳定复现时经作者同意构造，命名带 `.constructed`、标 `context.constructed: true` 并写明依据                                                                            |
| 封面、音频、图片直传            | 不录制，由 mock 本地生成并重写返回体中的外网 URL                                                                                                                                            |

详细采集与脱敏步骤见 `tests/fixtures/netease/README.md`。录完必须跑 `pnpm fixtures:index`（仅 `validated: true` 的录制可用），并跑相关回归测试与 `pnpm smoke:mock`。升级 SDK 时使用 `pnpm sdk:report` 与 `pnpm test:sdk [--candidate <本地包>]`。

## SDK 接缝与限制

- `tests/_kit/mock/runtime.ts` 持有状态与回放，`sdk-modules.ts` 绑定产品实际调用的具名函数；仅允许 runtime 从真 SDK 根入口复用 `generateDeviceId`、`getNcmFailureInfo`、`isNcmApiResponse`。
- `query-key.ts` 仅在匹配历史录制时转换参数格式；`fixture-format.ts` 按业务码补充失败元数据，mock 产生的断网/限流显式标注来源。
- 覆盖报告中的 `templates` 标出 mock 模板回退来源；严格 `World` 行为测试不使用模板回退。mock 是开发与浏览器测试的消费者，不替代 `tests/_kit/world.ts` 的精确行为测试。
