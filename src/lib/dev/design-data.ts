import type { Song } from '#lib/api/library.js';

export const designSong = (id: number, name: string, artist: string): Song => ({
  id,
  name,
  artists: [{ id: null, name: artist }],
  album: { id: null, name: null, coverUrl: null },
  duration: 212_000,
  downloadSize: null,
  availability: 'full',
  trackNumber: 1,
  disc: '1',
  aliases: [],
  translations: [],
  publishedAt: null,
});

export const designPlaylistName = {
  short: '夜航｜ヨルシカ 歌曲全收录',
  long: '夜航｜ヨルシカ 歌曲全收录：从《言って。》到《晴る》，n-buna 和 suis 写给每一个夏天的歌',
} as const;

export const designDescription = {
  short: '夏天傍晚听的歌，按发行时间排。',
  long: `这张歌单收的是夜鹿（ヨルシカ）从 2017 年到现在的全部歌曲，按发行时间排，适合一个人在夏天的傍晚从头听到尾。

关于夜鹿

夜鹿是 n-buna（作词、作曲、吉他）和 suis（主唱）两个人的乐队。n-buna 以前用 VOCALOID 写歌，组乐队以后，歌里还是那种透明、带一点潮湿的夏天空气。两个人几乎不露面，演唱会上也常常只有剪影，听的人只能从歌里认识他们。

名字来自《雲と幽霊》里的一句「夜しかもう眠れずに」：只有到了夜里，才睡得着。标志是两个背对背的月亮，中间的缝隙像指向傍晚六点的时针，也像一只闭不上的眼睛。

怎么听

· 想先找感觉：从《ただ君に晴れ》《言って。》开始，节奏轻快，副歌一下就能记住。
· 想听故事：按顺序听《だから僕は音楽を辞めた》和《エルマ》，两张专辑是一来一回的信。
· 想安静一会儿：《春泥棒》《花に亡霊》《晴る》，适合关了灯以后。

收录说明

1. 只收正式发行的版本，现场版、伴奏和翻唱都不在这里。
2. 同一首歌有单曲版和专辑版时，留专辑版。
3. 有些歌在网易云上没有版权，会显示成灰色，等上架了再补进来。

最后

如果你也是在某个夏天第一次听到他们，欢迎收藏。歌单会一直更新，新歌发行后一周内加进来。Thanks for listening, and see you next summer.`,
} as const;
