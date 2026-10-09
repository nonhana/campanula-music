<script lang='ts'>
  import type { AudioUrl, Level } from '$lib/probe/netease'
  import { errorText, logPage } from '$lib/probe/log'
  import LogView from '$lib/probe/LogView.svelte'
  import { playUrl } from '$lib/probe/netease'
  import { SONGS } from '$lib/probe/songs'
  import { onMount } from 'svelte'

  /** 地址约 20 分钟过期；提前取好的地址超过 15 分钟就不用了，现取。 */
  const PREFETCH_TTL = 15 * 60_000

  let audio: HTMLAudioElement
  let index = $state(0)
  let level = $state<Level>('exhigh')
  let prefetchNext = $state(false)
  let status = $state('还没开始')
  let position = $state(0)
  let duration = $state(0)
  let paused = $state(true)
  let lastHiddenLog = 0
  /** 提前取好的下一首地址：哪一首、哪种音质、什么时候取的。 */
  let prefetched: { index: number, level: Level, at: number, url: AudioUrl } | null = null

  const song = $derived(SONGS[index]!)

  const cover = (size: number) => `${song.cover.replace(/^http:/, 'https:')}?param=${size}y${size}`

  const wrap = (value: number) => (value + SONGS.length) % SONGS.length

  /** 用提前取好的地址（还新鲜、音质对得上），没有就现取。 */
  async function urlFor(target: number): Promise<{ url: AudioUrl, source: 'prefetched' | 'fetched' }> {
    const hit = prefetched
    prefetched = null
    if (hit && hit.index === target && hit.level === level && Date.now() - hit.at < PREFETCH_TTL)
      return { url: hit.url, source: 'prefetched' }
    return { url: await playUrl(SONGS[target]!.id, level), source: 'fetched' }
  }

  /** 开关打开时，这首开始放后就取好下一首的地址。 */
  async function prefetch(current: number) {
    if (!prefetchNext)
      return
    const target = wrap(current + 1)
    try {
      const url = await playUrl(SONGS[target]!.id, level)
      prefetched = { index: target, level, at: Date.now(), url }
      await logPage('play', '取好了下一首的地址', { song: SONGS[target]!.name })
    }
    catch (error) {
      await logPage('play', '提前取地址失败', { song: SONGS[target]!.name, error: errorText(error) })
    }
  }

  /** 取地址、换歌、开始放。锁屏时自动放下一首也走这里，记录里能看出当时页面是否可见、地址是现取还是提前取好的。 */
  async function load(next: number, reason: string) {
    index = wrap(next)
    const target = index
    const current = SONGS[target]!
    status = `正在取「${current.name}」的地址…`
    try {
      const { url, source } = await urlFor(target)
      audio.src = url.url
      setMetadata()
      await audio.play()
      status = `在放「${current.name}」（${url.level}，${url.type}）`
      await logPage('play', '开始放', { reason, song: current.name, level: url.level, url: source === 'prefetched' ? '提前取好' : '现取' })
      await prefetch(target)
    }
    catch (error) {
      status = `「${current.name}」放不了：${errorText(error)}`
      await logPage('play', '放不了', { reason, song: current.name, error: errorText(error) })
    }
  }

  function setMetadata() {
    if (!('mediaSession' in navigator))
      return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.name,
      artist: song.artist,
      album: song.album,
      artwork: [96, 256, 512].map(size => ({ src: cover(size), sizes: `${size}x${size}`, type: 'image/jpeg' })),
    })
  }

  function setPosition() {
    if (!('mediaSession' in navigator) || !Number.isFinite(audio.duration) || audio.duration <= 0)
      return
    navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate, position: Math.min(audio.currentTime, audio.duration) })
  }

  /** 锁屏和通知栏上的按钮：每按一下都记一笔，记录里的“hidden”说明是在锁屏或后台按的。 */
  function bindActions() {
    if (!('mediaSession' in navigator))
      return
    const actions: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => audio.play()],
      ['pause', () => audio.pause()],
      ['previoustrack', () => load(index - 1, '上一首按钮')],
      ['nexttrack', () => load(index + 1, '下一首按钮')],
      ['seekbackward', details => (audio.currentTime = Math.max(0, audio.currentTime - (details.seekOffset ?? 10)))],
      ['seekforward', details => (audio.currentTime = Math.min(audio.duration, audio.currentTime + (details.seekOffset ?? 10)))],
      ['seekto', (details) => {
        if (details.seekTime !== undefined)
          audio.currentTime = details.seekTime
      }],
      ['stop', () => audio.pause()],
    ]
    for (const [action, handler] of actions) {
      try {
        navigator.mediaSession.setActionHandler(action, (details) => {
          logPage('play', `媒体按钮：${action}`, details.seekTime === undefined ? undefined : { seekTime: Math.round(details.seekTime) })
          handler(details)
        })
      }
      catch (error) {
        logPage('play', `不支持的媒体按钮：${action}`, errorText(error))
      }
    }
  }

  function onTimeUpdate() {
    position = audio.currentTime
    // 页面不可见时每 30 秒记一笔，证明锁屏、切到后台时还在放
    if (document.visibilityState === 'hidden' && !audio.paused && Date.now() - lastHiddenLog > 30_000) {
      lastHiddenLog = Date.now()
      logPage('play', '后台仍在放', { song: song.name, at: Math.round(audio.currentTime) })
    }
  }

  function toggle() {
    if (!audio.src)
      load(index, '点了播放')
    else if (audio.paused)
      audio.play()
    else
      audio.pause()
  }

  const format = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

  onMount(() => {
    bindActions()
    const onVisibility = () => {
      lastHiddenLog = Date.now()
      logPage('play', document.visibilityState === 'hidden' ? '页面被隐藏' : '页面回到前台', { playing: !audio.paused, at: Math.round(audio.currentTime) })
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  })
</script>

<h1>后台播放、锁屏和通知栏控件</h1>

<section>
  <p>做法：点播放，然后切到别的 App、锁屏，等这首放完（第一首 2 分 45 秒），看能不能自动接着放下一首；在锁屏和通知栏上看封面，按暂停、下一首、上一首。回来后看记录。</p>
  <p>歌是不登录也能完整播放的免费歌，地址从网易云取。默认在上一首放完时才现取下一首的地址；打开下面的开关，就在这首开始放后先取好下一首的地址，放完直接切过去。</p>
  <p class='muted'>2026-10-10 在 OnePlus（Android 16）上，现取的做法有一次失败：上一首放完后系统几秒内就冻结了 Chrome，下一首的地址没取回来。</p>
  <label>音质
    <select bind:value={level}>
      <option value='standard'>标准</option>
      <option value='exhigh'>极高</option>
      <option value='lossless'>无损（flac）</option>
    </select>
  </label>
  <label><input type='checkbox' bind:checked={prefetchNext} /> 提前取好下一首的地址</label>
</section>

<section class='player'>
  <img src={cover(256)} alt='' width='128' height='128' />
  <div>
    <strong>{song.name}</strong>
    <div class='muted'>{song.artist}</div>
    <div class='muted'>{format(position)} / {format(duration)}</div>
  </div>
  <div class='controls'>
    <button type='button' onclick={() => load(index - 1, '页面上一首')}>上一首</button>
    <button type='button' onclick={toggle}>{paused ? '播放' : '暂停'}</button>
    <button type='button' onclick={() => load(index + 1, '页面下一首')}>下一首</button>
  </div>
  <p>{status}</p>
</section>

<audio
  bind:this={audio}
  preload='auto'
  onplay={() => {
    paused = false
    logPage('play', 'play 事件', { song: song.name })
  }}
  onpause={() => {
    paused = true
    logPage('play', 'pause 事件', { song: song.name, at: Math.round(audio.currentTime) })
  }}
  onended={() => {
    logPage('play', '放完一首', { song: song.name })
    load(index + 1, '上一首放完')
  }}
  onerror={() => logPage('play', 'audio 出错', { song: song.name, code: audio.error?.code, message: audio.error?.message })}
  onstalled={() => logPage('play', 'stalled', { song: song.name, at: Math.round(audio.currentTime) })}
  onloadedmetadata={() => {
    duration = audio.duration
    setPosition()
  }}
  ontimeupdate={onTimeUpdate}
  onseeked={setPosition}
  onratechange={setPosition}
></audio>

<LogView topic='play' />

<style>
  .player {
    display: grid;
    grid-template-columns: 128px 1fr;
    gap: 12px;
    align-items: center;
  }
  .player img {
    border-radius: 8px;
  }
  .controls {
    display: flex;
    grid-column: 1 / -1;
    gap: 8px;
  }
  .player p {
    grid-column: 1 / -1;
    margin: 0;
  }
  .muted {
    color: #4b5563;
  }
</style>
