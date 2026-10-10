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
pnpm dev
```

提交前钩子会对暂存的文件跑 `eslint --fix`；`pnpm lint`、`pnpm check` 在 CI 里也会跑。

### License

[MIT](./LICENSE)
