# 官网示例素材

2026-11-17 为官网试听新建。三段音频、六个标题、英文示意歌词与中文翻译、三张封面均为本项目这次制作的原创内容，没有使用录音、采样库、现成曲目、原型封面、真实歌手或听众数据。音频是器乐合成，歌词用来演示逐字高亮和翻译，不声称音频里有这些人声。

| 文件                  | 内容与来源                                                             | 分发许可                                        |
| --------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| `window.mp3`          | Window Light / 窗边的光；24 秒原创钟音与低音，由下述谱面合成           | CC0-1.0                                         |
| `tide.mp3`            | Tidal Steps / 潮汐的脚步；24 秒原创钟音与低音，由下述谱面合成          | CC0-1.0                                         |
| `rain.mp3`            | After the Rain / 雨停以后；24 秒原创钟音与低音，由下述谱面合成         | CC0-1.0                                         |
| `window.svg`          | 窗框、日光与植物；新写的 SVG 几何图形                                  | CC0-1.0                                         |
| `tide.svg`            | 海面、沙岸与浪线；新写的 SVG 几何图形                                  | CC0-1.0                                         |
| `rain.svg`            | 雨后山坡与水洼；新写的 SVG 几何图形                                    | CC0-1.0                                         |
| `player-desktop.webp` | 同一份静态 demo 的真实 Chromium 截图，1120×786，暂停的第一首与歌词翻译 | 应用截图，随项目 MIT 许可；所含素材遵守上述许可 |
| `player-phone.webp`   | 同一份静态 demo 的真实 Chromium 截图，350×574，暂停的第一首与播放控制  | 应用截图，随项目 MIT 许可；所含素材遵守上述许可 |

本次原创素材以 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) 提供，可复制、修改和再分发，包括商业使用。许可不替代 Campanula 商标、应用代码或依赖自己的许可。应用截图中的 Noto 字体由项目已安装的 `@fontsource-variable/noto-sans*` 提供（SIL Open Font License 1.1）；Flower 和其他操作图标来自已安装的 Lucide（ISC）。截图没有来自第三方网站的图像。

音频的 MIDI 音高序列、合成公式、音量包络及封面源码保存在 `website/demo/create-media.mts`；它不参加日常构建，已提交的 MP3/SVG 即可在干净 checkout 使用。需要重制时，安装 FFmpeg 后从仓库根运行 `pnpm exec tsx website/demo/create-media.mts`。公式输出 44.1 kHz 单声道 PCM，再由 FFmpeg 的 libmp3lame 编码为 96 kbps MP3；没有模型服务或远端素材下载。MP3 容器包含编码器补齐的极短尾部，标称时长为 24 秒。

示例账号、歌单、曲目和示意歌词在 `website/demo/sample.ts`，不是从网易云取得的返回。截图先启动自有随机端口的静态候选，在独立空 Chromium 中进入 `/demo/?screen=player`，等封面和字体加载完成后截图并转 WebP；不使用作者的浏览器。对应运行与文件校验清单见 `docs/acceptance/runs/issue-44-step3.md`。
