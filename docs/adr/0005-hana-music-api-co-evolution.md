# hana-music-api 作为独立发布的上游，与 Campanula 一起演进

hana-music-api 是作者自己的开源 SDK，单独发布到 npm，有 Campanula 以外的使用者。Campanula 遇到它的问题时，回到它的仓库修复并发版，不在 Campanula 里绕路：

- 问题开在 `nonhana/hana-music-api` 的 Issue 里，依赖它的 Campanula Issue 用“被阻塞”关系关联过去。
- Campanula 主分支只依赖 npm 上已发布的版本，不提交本地 link。
- Campanula 用到的接口，返回体类型直接在 hana-music-api 对应模块里收窄，所有使用者共享；Campanula 只负责把这些类型映射成自己的界面数据。
- 收窄的方式是运行时校验：每个模块的返回体结构用 Effect Schema 定义，TypeScript 类型由它推导；SDK 在返回结果前先校验，结构不符时抛出 `UnexpectedUpstreamShape`。结构定义只声明在真实返回里确认过的字段，未声明的字段原样保留；脱敏后的真实返回作为契约测试数据。
- 结构定义同时对外导出：用 `Schema.toStandardSchemaV1` 包装后导出，并附上每个模块推导出的 TypeScript 类型。对外承诺的只有 Standard Schema 通用接口（`~standard.validate`）和这些类型；包装后的对象仍是原来的 Effect Schema，熟悉 Effect 的使用者可以照常用，但这部分不在兼容承诺之内。Campanula 的浏览器端只用类型，不打包 Effect。

## Considered Options

- **纯使用，在 Campanula 里绕过问题**：Campanula 会堆满绕路代码，SDK 本身也得不到改进。
- **把 hana-music-api 并进同一个仓库**：会把一个独立发布的 SDK 和一个应用绑死。
- **返回体类型只在 Campanula 侧定义**：SDK 不必为上游变化负责，但这和 hana-music-api“逐个模块收窄返回类型”的既定演进方向相反。
- **只写 TypeScript 类型、运行时不校验**：上游结构一变，错误会在别处冒出来。第一次尝试就因此丢掉了所有歌单：测试假设 `body.playlist`，真实返回是 `body.data.playlist`，331 个测试全部通过。
- **直接把 Effect Schema 作为公开接口导出**：功能最全，但 Effect 的 Schema 接口会成为对外承诺的一部分，effect 一升大版本，所有使用者都可能跟着出问题。
