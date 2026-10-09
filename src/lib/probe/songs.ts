export interface ProbeSong {
  id: number
  name: string
  artist: string
  album: string
  cover: string
  durationMs: number
}

/**
 * 验证关卡③只用这 6 首免费歌：不登录也能拿到完整的播放地址和下载地址
 * （2026-10-09 在 hkg1 实测，标准到无损都是完整音频），全程不碰作者的账号。
 * 最短的那首放第一，测“锁屏时自动放下一首”不用等太久。
 */
export const SONGS: readonly ProbeSong[] = [
  { id: 1327620611, name: 'River Flows In You(纯钢琴)', artist: '愚人幽篁里', album: 'River Flows In You', cover: 'https://p3.music.126.net/K27jzoK0qyyv6--Ig0zEWw==/109951163681686469.jpg', durationMs: 165070 },
  { id: 2694833305, name: '春のお弔い', artist: '魚住英里奈', album: 'ヨ幽区', cover: 'https://p3.music.126.net/68To0M9JDD6lm7XzykeZXA==/109951170723146761.jpg', durationMs: 244000 },
  { id: 26209798, name: '千本桜', artist: '黒うさP / 初音ミク / 鏡音リン / 鏡音レン / 巡音ルカ / KAITO / MEIKO', album: '5th Anniversary Best', cover: 'https://p3.music.126.net/C0oHI_hWGow6yQYvFKxw0w==/2444214348571696.jpg', durationMs: 245395 },
  { id: 471403214, name: 'つちかひの唄', artist: 'stellatram', album: 'Kaleido Sphere ～天淵の双つ星～', cover: 'https://p3.music.126.net/cPwdlJxGCtX0e2L3SMQksg==/18915998044327357.jpg', durationMs: 266893 },
  { id: 2092595510, name: '平凡之路', artist: '陌尘', album: '平凡之路', cover: 'https://p4.music.126.net/XTETKOMFLJD2mAPpTrgPew==/109951168996730286.jpg', durationMs: 299975 },
  { id: 22676238, name: '無神論者のためのセレナータ', artist: 'love solfege', album: 'the note of satanism', cover: 'https://p4.music.126.net/ek5C5HeDHICGjziHhTMCow==/749866930165203.jpg', durationMs: 334466 },
]

export function songName(id: number): string {
  return SONGS.find(song => song.id === id)?.name ?? String(id)
}
