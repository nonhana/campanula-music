# 代码规范

能用工具机械检查的规则以 `eslint.config.mts`、`uno.config.mts` 和 `oxfmt.config.mts` 为准，本文件只写需要人工判断的规范。

## 改动与复用

- **最小改动**：用最小、清晰的改动解决当前需求。不改无关格式与命名，不加臆测的扩展点、配置、依赖或兜底，不顺手清理无关代码。
- **先复用已有层**：优先复用已有的功能组件、`.svelte.ts` 状态模块、App 模块与服务端工具，不另起一层。
- **helper 不复制**：同一个 helper 不允许复制到第二个文件。两处及以上需要共用时，移至 `src/lib/` 下对应领域模块，动手前先搜现成实现。
- **三次法则再抽象**：不为单个调用方新抽 helper、class 或接口；至少三个调用方需要同一抽象且它表达稳定领域概念时才抽。
- **不重复造轮子**：框架或已装依赖能满足时直接使用。

## 代码约定

- **契约穷尽处理**：接口返回和联合类型的每个分支都要处理；未支持分支用 `never` 让编译器报错，不用 `if` 静默跳过。
- **服务端无状态**：不在内存保存跨请求状态，不在启动时读写本地文件。
- **`resolve()` 封装的站内链接**：由函数用 `resolve()` 拼好的站内地址（如 `songs/credit-link.ts`），返回类型标为 `ResolvedPathname`（`$app/types`），不拓宽为 `string`。因 ESLint 不开 `projectService`，`svelte/no-navigation-without-resolve` 识别不了包装函数：在 `<a>` 前加 `<!-- eslint-disable svelte/no-navigation-without-resolve -- 地址由 <函数> 用 resolve() 拼好 -->`，元素结束后补 `<!-- eslint-enable svelte/no-navigation-without-resolve -->`（oxfmt 会拆行，`eslint-disable-next-line` 盖不住 `href`）。站外链接和 `data:` 下载加 `rel="external"`；`goto()` 用 `// eslint-disable-next-line` 附同类说明。
- **只在不可信边界校验**：边界处做校验与恢复；契约内部直接写，出错明确失败，不加冗余防御和静默兜底。
- **偏函数式、就地可追踪**：优先纯函数、显式数据流和不可变值，隔离副作用；沿用周围已有写法。
- **本地模块写实际后缀**：指向本地 TS 源文件的 import / re-export / 动态 import 必须写 `.ts`、`.svelte.ts`、`.mts` 等实际后缀，不写 `.js` 也不省略；包名与框架虚拟模块沿用公开路径。
- **不重复标注可推断类型**：TypeScript 能自动推断的类型不手写。
- **函数写成箭头表达式**：编写时即遵循 `func-style: expression`。
- **排版与 import 分工**：行宽、分号、引号、断行全交 `oxfmt`（`pnpm fmt` / `pnpm fmt:check`）；import 排序、分组和尾空行由 ESLint（`pnpm lint:fix`）管理，不手写对齐。

## 注释

- **默认不写**：代码与命名能说清的绝不写注释，遇到冗余注释直接删。
- **只写代码说不出的事实**：时机约定、跨模块不变量、已知坑、替身行为依据。一条注释一句话、最多两行，只用 `//` 或 `/** */`。
- **不带文档编号**：不写 ADR、Spec、Issue 编号，也不写“见某文档”。历史理由归 `docs/adr/`，注释只交代当前成立的前提。

## 测试规范

- **只断言听众看得到的结果**：断言 App 状态、发往服务端的请求、本机持久化、Cookie、服务器日志与网易云调用记录；不测内部结构、私有调用关系和精确文案，不写“替身原样回传”的空证明测试。
- **网易云响应来自脱敏录制**：通过 `world.netease.reply()` 注入经结构校验的录制，不在测试中手写网易云返回体。
- **替身照真实规范写**：浏览器能力与 SDK 替身照标准或库源码实现（含抛错与事件时机），在注释中注明依据。
- **升级本机数据库版本必测迁移**：改动 `src/lib/app/local.ts` 的 `VERSION` 时，必须新增从上一版升级的测试——先用 `Device.preload()` 按旧版结构写入数据，再打开 App，断言既有数据保留且应重同步的部分正确同步。
