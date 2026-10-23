# Campanula 自己的接口继续用 `+server.ts`，不用 SvelteKit 远程函数

Campanula 的服务端接口仍是 `src/routes/api/**/+server.ts`，浏览器经 `src/lib/app/api.ts` 用 fetch 调用（ADR-0004）。路径和请求、响应类型对不上号的问题，用一份按领域命名的端点目录在编译期配对解决，不改用 SvelteKit 的远程函数（remote functions：`*.remote.ts` 里的 `query` / `command` / `form`）。2026-10-23 架构审查时对照 SvelteKit 3.1.0 的源码和文档评估，作者同日决定。

远程函数解决的是“组件里直接 `await` 服务端数据、类型自动配对”。Campanula 的组件从不直接调服务端，都经过去掉界面的整个 App（ADR-0007 的本地副本和请求节奏），用不上前一半；后一半端点目录就能给。而它和现有设计有几处直接冲突：

- **还是实验特性**：要在配置里打开 `experimental.remoteFunctions` 和 `compilerOptions.experimental.async`，文档写明“可能有缺陷、随时会变”（svelte-kit `documentation/docs/20-core-concepts/60-remote-functions.md`，`packages/kit/src/core/config/options.js` 里默认 `false`）。
- **读请求不能写 Cookie**：远程函数里只有 `form`、`command` 能写 Cookie，`query` 不能，也不能设别的响应头（同一文档 “Note that some properties of `RequestEvent` are different”）。Campanula 读接口时会顺手续期登录 Cookie（`src/lib/server/session.ts` 的 `asSignedIn`），操作频繁时要回 `retry-after`（`src/lib/server/respond.ts`）。照搬就得把所有读请求都写成 `command`，`query` 的缓存和去重也就没了。
- **绕过 App 的请求接缝**：客户端桩直接调全局 `fetch`（`packages/kit/src/runtime/client/remote-functions/shared.svelte.js`），请求选项只有方法、请求体和请求头，没有 `keepalive`。Campanula 的请求都走 `BrowserCapabilities.fetch`：测试接入点靠它给每台设备单独的 Cookie、断网开关和请求记录，好几台设备跑在同一个进程里；页面隐藏时提交晚一点才提交的修改要靠 `keepalive`。
- **地址和请求体不透明**：请求发到 `/_app/remote/<id>`，载荷用 devalue 编码。现在测试断言“发了什么请求、路径和请求体是什么”，换了以后这些断言就失去意义。
- **多一份缓存**：`query` 的结果在客户端按参数缓存。曲库数据的缓存和同步已经由 App 的本地副本负责（ADR-0007），两份缓存会互相打架。
- **错误模型**：校验失败统一变成 400 交给 `handleError`，Campanula 按种类区分的 `ApiError`（`src/lib/api/errors.ts`）要另外穿过 `App.Error` 传回来。

## Considered Options

- **改用远程函数**：类型自动配对，不用写路由文件。但有上面几处冲突，其中“读请求不能写 Cookie”和“绕过请求接缝”没有绕法。
- **一个 `/api/[...path]` 总入口加分发表**：少写 38 个路由文件，但每个文件本来只有 8–21 行，搬进表里行数不会少；还会丢掉 SvelteKit 按路由生成的参数类型，Vercel 上按路由拆分云函数的方式也会变（推测，没有实测）。
- **保持现状**：客户端手写路径、自己指定响应类型，服务端靠每个文件里的 `satisfies` 检查，两边只靠注释对上号。写错路径或类型都能编译通过。

## Consequences

- 每个接口仍然是 `src/routes/api/` 下的一个 `+server.ts`，校验、登录和错误约定照旧（`request.ts`、`respondSignedIn`、`withNetease`）。
- 端点目录放在 `src/lib/api/`：每个端点一条，写清方法、路径、请求和响应类型；客户端按端点调用，服务端的类型检查来自同一条。目录里只有类型和拼路径的小函数，浏览器照旧不打包 Effect（ADR-0005）。
- 线上路径不变，测试接入点和现有测试不受影响。
- 以后想重新考虑远程函数，先确认三件事：已经不是实验特性；`query` 能写 Cookie；客户端能换掉 fetch 并支持 `keepalive`。
