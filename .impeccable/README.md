# .impeccable

`design.json` 是作者批准的人工快照（impeccable 的 sidecar），不是 impeccable 生成物，也不是构建产物。

- **谁**：作者，或专门改设计系统的那张票的 agent。
- **什么时候**：只在 `DESIGN.md` / `uno.palette.ts` 变更的票里同步；功能票不要手改。
- **不要手改哪部分**：组件 / CSS / HTML 和 `colorMeta` 段；要改就开设计系统票。本票 r2 对 Mini Player 的 CSS/HTML 是按 DESIGN 同步的一次性例外，之后先跑生成/同步流程。
- **漂移怎么发现**：逐条核对 28 条 `colorMeta.canonical` 与 `DESIGN.md` frontmatter / `uno.palette.ts` 一致；不一致就是漂移。`pnpm lint` 不检查这份快照。
- `generatedAt` 是内容最后一次人工同步时间，不是生成时间。

色板的源头是 `uno.palette.ts`（`uno.config.ts` 的 theme 用这一份），规则与文案的源头是 `DESIGN.md`。
