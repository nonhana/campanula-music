## Campanula Music

属于自己的风铃草音乐。一个可自部署的个人第三方网易云播放器，每个部署实例绑定部署者自己的网易云账号。

### 技术栈

- **框架**: [SvelteKit](https://kit.svelte.dev/) (Svelte 5)
- **样式**: [UnoCSS](https://unocss.dev/)
- **数据接入**: [hana-music-api](https://github.com/nonhana/hana-music-api)（网易云 SDK，经应用内门面调用）
- **构建工具**: [Vite](https://vitejs.dev/)
- **测试**: [Vitest](https://vitest.dev/)
- **部署**: 自部署单进程（`@sveltejs/adapter-node`，Node ≥ 24）

### 本地开发

要求 Node ≥ 24 与 pnpm。

```bash
pnpm install
pnpm dev
```

### 测试与检查

```bash
pnpm test:run    # 全量测试
pnpm check       # 类型检查
pnpm lint        # 代码规范
```

### 构建与部署

```bash
pnpm build       # 产物输出到 build/
PORT=3000 node build
```

或使用 Docker：

```bash
docker build -t campanula-music .
docker run -p 3000:3000 campanula-music
```

首次使用打开页面后，按引导扫码绑定自己的网易云账号；凭据持久化在本地数据目录，重启不丢失。

### License

[MIT](./LICENSE)
