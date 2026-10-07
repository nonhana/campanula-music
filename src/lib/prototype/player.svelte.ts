// PROTOTYPE：内存里的播放状态，三个变体共用。只模拟进度，不出声音、不持久化。
import type { Song } from './data'
import type { LyricKind as LyricSetKind, LyricLine } from './lyrics'
import { likedSongs } from './data'
import { lyricsOf } from './lyrics'

export type PlayMode = 'loop' | 'one' | 'shuffle'

export interface PlaySource {
  kind: 'liked' | 'playlist' | 'album' | 'artist' | 'daily' | 'downloads'
  /** 显示给听众的播放来源名称 */
  name: string
  id?: string
}

export const playModeLabel: Record<PlayMode, string> = {
  loop: '列表循环',
  one: '单曲循环',
  shuffle: '随机播放',
}

class PrototypePlayer {
  queue = $state.raw<Song[]>(likedSongs)
  index = $state(0)
  playing = $state(true)
  position = $state(51.3)
  mode = $state<PlayMode>('loop')
  volume = $state(0.72)
  source = $state<PlaySource>({ kind: 'liked', name: '我喜欢的音乐', id: 'liked' })

  current = $derived<Song | undefined>(this.queue[this.index])
  progress = $derived(this.current ? Math.min(1, this.position / this.current.duration) : 0)
  /** 当前歌曲的歌词；原型里只有两首歌带歌词数据（逐字一首、逐行一首） */
  private lyricSet = $derived(this.current ? lyricsOf(this.current.id) : null)
  lyrics = $derived<LyricLine[] | null>(this.lyricSet?.lines ?? null)
  /** yrc = 逐字，lrc = 只有逐行 */
  lyricKind = $derived<LyricSetKind | null>(this.lyricSet?.kind ?? null)
  hasTranslation = $derived(this.lyricSet?.hasTranslation ?? false)
  hasRomaji = $derived(this.lyricSet?.hasRomaji ?? false)
  /** 离线时只有已下载的歌能播 */
  offline = $state(false)

  /** 能不能播：无版权的不能播；离线时没下载的不能播 */
  playable(song: Song): boolean {
    return !song.unavailable && (!this.offline || song.download === 'done')
  }

  playFrom(list: Song[], i: number, source: PlaySource) {
    if (!list[i] || !this.playable(list[i]))
      return
    this.queue = list
    this.index = i
    this.position = 0
    this.playing = true
    this.source = source
  }

  toggle() {
    this.playing = !this.playing
  }

  next() {
    this.step(1)
  }

  prev() {
    if (this.position > 3) {
      this.position = 0
      return
    }
    this.step(-1)
  }

  private step(dir: 1 | -1) {
    const n = this.queue.length
    if (n === 0)
      return
    let i = this.index
    for (let tries = 0; tries < n; tries++) {
      i = this.mode === 'shuffle' && dir === 1
        ? Math.floor(Math.random() * n)
        : (i + dir + n) % n
      if (this.playable(this.queue[i]))
        break
    }
    this.index = i
    this.position = 0
  }

  seek(seconds: number) {
    if (!this.current)
      return
    this.position = Math.max(0, Math.min(this.current.duration, seconds))
  }

  cycleMode() {
    this.mode = this.mode === 'loop' ? 'one' : this.mode === 'one' ? 'shuffle' : 'loop'
  }

  /** 由原型页面的计时器驱动 */
  tick(dt: number) {
    if (!this.playing || !this.current)
      return
    this.position += dt
    if (this.position >= this.current.duration) {
      if (this.mode === 'one')
        this.position = 0
      else this.next()
    }
  }

  playNext(song: Song) {
    const q = [...this.queue]
    q.splice(this.index + 1, 0, song)
    this.queue = q
  }

  enqueue(song: Song) {
    this.queue = [...this.queue, song]
  }

  /** 照官方：搜索结果里点一首歌，插到当前歌曲后面并立即播放，不替换播放队列 */
  playNow(song: Song) {
    if (!this.playable(song))
      return
    const q = [...this.queue]
    q.splice(this.index + 1, 0, song)
    this.queue = q
    this.index += 1
    this.position = 0
    this.playing = true
  }

  removeAt(i: number) {
    if (i === this.index)
      return
    const q = [...this.queue]
    q.splice(i, 1)
    if (i < this.index)
      this.index -= 1
    this.queue = q
  }

  clear() {
    const cur = this.current
    this.queue = cur ? [cur] : []
    this.index = 0
  }
}

export const player = new PrototypePlayer()
