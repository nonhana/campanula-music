# 只有浅色主题，不做深色模式

Campanula 只提供浅色主题，视觉语言围绕 `uno.config.ts` 里的浅色色板建立。深色模式不在考虑范围内，也不为它预留：不跟随系统切换，不准备第二套颜色。这是作者的明确取舍。

## Considered Options

- **浅色加深色，跟随系统切换**：夜里用手机听歌时更友好，Auxio、Spotify、网易云都有深色模式；但每个界面都要设计和验收两套。
- **先只做浅色，但颜色按用途命名，留到以后补深色**：给深色模式留了退路，但作者不打算做深色。

## Consequences

- 系统处于深色模式时，Campanula 仍然是浅色。
- 页面必须声明 `<meta name="color-scheme" content="only light">`，退出 Android Chrome 的“自动深色主题”；否则开启了这项功能的听众会看到被浏览器强行反色的界面（见 Chrome for Developers《Auto Dark Theme》）。
- 想加深色模式，必须先推翻本决定。
