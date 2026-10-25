# 写歌曲信息核心的样本音频（#79）

`tests/song-info-core.test.ts` 用的样本，都是生成的两秒静音和一张 16×16 的纯色图，不是真歌（真歌不能提交）。2026-10-25 用 ffmpeg 9.0.2、flac 1.5.0 生成：

```sh
ffmpeg -f lavfi -i color=c=0x9ad9c0:s=16x16 -frames:v 1 cover.jpg
# 带着旧的 ID3v2.4（标题“旧标题”）和结尾的 ID3v1：测试核对它们被去掉
ffmpeg -f lavfi -i anullsrc=r=22050:cl=mono -t 2 -c:a libmp3lame -b:a 32k -id3v2_version 4 -write_id3v1 1 -metadata title=旧标题 -metadata artist=旧歌手 silence.mp3
# reference libFLAC 默认写 SEEKTABLE 和 8 KB 填充；带着旧的 VORBIS_COMMENT 和一张旧封面：测试核对 SEEKTABLE、vendor 原样保留，旧注释、旧封面、填充换掉
ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 2 -c:a pcm_s16le silence.wav
flac --tag=TITLE=旧标题 --tag=ARTIST=旧歌手 --picture=cover.jpg -o silence.flac silence.wav
```
