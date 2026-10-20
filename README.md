## Campanula Music

开源的第三方网易云音乐播放器：听众用自己的网易云账号登录，在手机和桌面上听歌、搜歌，把喜欢的音乐收进自己的曲库。可以安装成手机和桌面上的独立 App（PWA），以自部署为主。

v1 正在 `rewrite/v1` 分支上从零重写，还不能使用。

- 产品与设计：[PRODUCT.md](./PRODUCT.md)、[DESIGN.md](./DESIGN.md)
- 术语：[GLOSSARY.md](./GLOSSARY.md)
- 架构决策：[docs/adr/](./docs/adr/)

### 开发

需要 Node.js（版本见 `.node-version`）和 pnpm（版本见 `package.json` 的 `packageManager`）。

```bash
pnpm install
cp .env.example .env   # 填上 COOKIE_SECRET：openssl rand -base64 32
pnpm dev               # 真账号，端口 5173
pnpm dev:mock          # mock 测试数据，端口 5174，不需要登录
```

mock 的账号、歌单、红心、搜索、播放地址都来自 `tests/fixtures/netease/`，写操作只改内存状态，可重置；详见 `docs/agents/mock.md`。

站长要配的环境变量见 `.env.example`：`COOKIE_SECRET`（必填，加密登录 Cookie 的密钥，至少 32 个字符，升级时保留同一个，换了所有听众都要重新登录）、`NETEASE_REAL_IP`（可选，真实的国内 IP）。

提交前钩子会对暂存的文件跑 `eslint --fix`；`pnpm lint`、`pnpm check` 在 CI 里也会跑。

编码代理按 [Svelte 官方 AI 工具](https://svelte.dev/docs/ai/overview) 配置：提示写在 `AGENTS.md`，omp 用的 Svelte MCP 服务器和 `svelte-file-editor` 子代理在 `.omp/`。

### License

[MIT](./LICENSE)
