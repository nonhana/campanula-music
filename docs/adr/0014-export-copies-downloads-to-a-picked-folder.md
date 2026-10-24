# 导出是另存一份，下载仍存在 Campanula 里

下载仍存在 Campanula 自己的本机存储里（ADR-0006）。听众想要普通音频文件时用“导出”：把选中的下载另存一份，写进听众这次选的文件夹，并把歌曲信息（歌名、歌手、专辑、第几首、封面、歌词等）写进文件，让别的播放器也能显示。每次导出都重新选文件夹，不记住文件夹权限。没有改成“下载直接存进听众的文件夹”，原因有三条：Android Chrome 的文件夹权限不能跨会话保留（[Chromium issue 485677966](https://issuetracker.google.com/issues/485677966)），每次打开都要重新选；后台下载（Background Fetch）写不进听众选的文件夹；选文件夹、请求权限都必须在听众点按的那一下里发生。

## Considered Options

- **下载直接存进听众选的文件夹**：理由见上。
- **记住文件夹，下次直接写**：Android 上权限不能跨会话保留，做不到。
- **用系统分享（Web Share）把文件交出去**：一次最多 10 个文件、合计 50 MB（[Chromium issue 408128761](https://issues.chromium.org/issues/408128761)），整份歌单导不出去。

## Consequences

- 导出的歌在从 Campanula 删除前要占两份空间：导出前写明会再占多少，导出完可以一键从 Campanula 删除。
- 导出的文件属于听众，Campanula 不再管它：从 Campanula 删除下载不影响导出的文件；再导出一次不覆盖已有的文件。
- 文件里只写网易云给的信息，拿不到的（流派、ISRC、版权声明等）不编造。
- 导出的文件离开了 Campanula，可以随意复制、分享，ADR-0006 里说的被版权方投诉的风险因此更大。
- 只在标准环境（Android Chrome、桌面 Chrome 和 Edge）提供；浏览器不支持选文件夹时不显示“导出”。
