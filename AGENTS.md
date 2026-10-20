# Campanula Music — Agent Instructions

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues in `nonhana/campanula-music`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.

**Decisions**: before stating or relying on a design decision (in a reply, a plan, or code), check `docs/adr/`; each filename names its decision. ADRs outrank recalled memories.

### Delivery

Before implementing a ticket, read `docs/agents/delivery.md`: branch, test seam, real-account rules, and hand-off with a trial checklist for the author (the author verifies by trying it; screenshots only on request).

### Mock 与浏览器验证

- 日常界面、动效和 reviewer 验证走 mock：`pnpm dev:mock`（5174），`scripts/browser`（默认 mock，不需要登录）。见 `docs/agents/mock.md`。
- 真账号只用于作者最后的交付试用，走专用浏览器 `scripts/axi`；打开前先 `scripts/browser check --real`，不是登录态就停下请作者扫码。见 `docs/agents/browser.md`。
- reviewer 不自己启动 Chrome；父 agent 用 mock 做视觉验证，把结论和截图路径交给 reviewer。

## Svelte

When unsure about a Svelte 5 / SvelteKit API, look it up with the Svelte MCP (`.omp/mcp.json`): `list-sections`, then `get-documentation` for the relevant sections. The `svelte-file-editor` subagent lives in `.omp/agents/`.
