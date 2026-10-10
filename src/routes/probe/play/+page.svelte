<script lang='ts'>
  import type { AudioUrl, Level } from '$lib/probe/netease'
  import { errorText, logPage } from '$lib/probe/log'
  import LogView from '$lib/probe/LogView.svelte'
  import { playUrl } from '$lib/probe/netease'
  import { SONGS } from '$lib/probe/songs'
  import { onMount } from 'svelte'

  /**
   * 换下一首的方式。2026-10-10 在 Android 16 上查明：一首放完时 Chrome 结束媒体会话、交还音频焦点，
   * 前台服务随之撤掉；下一首在后台重新申请音频焦点会被系统拦下（AS.HardeningEnforcer，Android 15 起）。
   * 后三种方式都提前取好下一首的地址，区别在换歌时“正在播放”会不会断。
   */
  type Advance = 'ended-fetch' | 'ended-prefetch' | 'early' | 'overlap'
  const ADVANCES: Array<[Advance, string]> = [
    ['ended-fetch', '放完再现取地址、换歌'],
    ['ended-prefetch', '放完再换歌（地址提前取好）'],
    ['early', '剩 1 秒时在同一个播放器里换歌'],
    ['overlap', '剩 1 秒时用另一个播放器先放下一首'],
  ]
  /** 剩多少秒时提前换歌 */
  const EARLY_S = 1
  /** 地址约 20 分钟过期；提前取好的地址超过 15 分钟就不用了，现取。 */
  const PREFETCH_TTL = 15 * 60_000

  const players: HTMLAudioElement[] = []
  let active = 0
  let index = $state(0)
  let level = $state<Level>('exhigh')
  let advance = $state<Advance>('ended-fetch')
  let status = $state('还没开始')
  let position = $state(0)
  let duration = $state(0)
  let paused = $state(true)
  let lastHiddenLog = 0
  /** 正在提前换歌，免得 timeupdate 重复触发 */
  let switching = false
  /** 提前取好的下一首地址：哪一首、哪种音质、什么时候取的。 */
  let prefetched: { index: number, level: Level, at: number, url: AudioUrl } | null = null

  const song = $derived(SONGS[index]!)
  const current = () => players[active]!
  const wrap = (value: number) => (value + SONGS.length) % SONGS.length
  const cover = (size: number) => `${song.cover.replace(/^http:/, 'https:')}?param=${size}y${size}`
  const label = (mode: Advance) => ADVANCES.find(([value]) => value === mode)![1]

  /** 用提前取好的地址（还新鲜、音质对得上），没有就现取。 */
  async function urlFor(target: number): Promise<{ url: AudioUrl, source: string }> {
    const hit = prefetched
    prefetched = null
    if (hit && hit.index === target && hit.level === level && Date.now() - hit.at < PREFETCH_TTL)
      return { url: hit.url, source: '提前取好' }
    return { url: await playUrl(SONGS[target]!.id, level), source: '现取' }
  }

  /** 除了“放完再现取”，这首开始放后就取好下一首的地址。 */
  async function prefetch(from: number) {
    if (advance === 'ended-fetch')
      return
    const target = wrap(from + 1)
    try {
      const url = await playUrl(SONGS[target]!.id, level)
      prefetched = { index: target, level, at: Date.now(), url }
      await logPage('play', '取好了下一首的地址', { song: SONGS[target]!.name })
    }
    catch (error) {
      await logPage('play', '提前取地址失败', { song: SONGS[target]!.name, error: errorText(error) })
    }
  }

  /** 在指定的播放器上放第 target 首。 */
  async function startOn(slot: number, target: number, reason: string) {
    const item = SONGS[target]!
    status = `正在取「${item.name}」的地址…`
    const { url, source } = await urlFor(target)
    const player = players[slot]!
    player.src = url.url
    active = slot
    index = target
    setMetadata()
    await player.play()
    status = `在放「${item.name}」（${url.level}，${url.type}）`
    await logPage('play', '开始放', { reason, song: item.name, level: url.level, url: source, player: slot, mode: label(advance) })
  }

  /** 按钮、放完一首、“剩 1 秒时在同一个播放器里换歌”都走这里：在当前播放器上换歌。 */
  async function load(next: number, reason: string) {
    const target = wrap(next)
    try {
      players[1 - active]!.pause()
      await startOn(active, target, reason)
      await prefetch(target)
    }
    catch (error) {
      status = `「${SONGS[target]!.name}」放不了：${errorText(error)}`
      await logPage('play', '放不了', { reason, song: SONGS[target]!.name, error: errorText(error) })
    }
  }

  /** 剩 1 秒时用另一个播放器先放下一首，开始出声后再停掉旧的，换歌时始终有一个在放。 */
  async function overlapNext() {
    const old = current()
    const target = wrap(index + 1)
    try {
      await startOn(1 - active, target, '剩 1 秒时换歌')
      old.pause()
      await prefetch(target)
    }
    catch (error) {
      await logPage('play', '放不了', { reason: '剩 1 秒时换歌', song: SONGS[target]!.name, error: errorText(error) })
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
    const audio = current()
    if (!('mediaSession' in navigator) || !Number.isFinite(audio.duration) || audio.duration <= 0)
      return
    navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate, position: Math.min(audio.currentTime, audio.duration) })
  }

  /** 锁屏和通知栏上的按钮：每按一下都记一笔，记录里的“hidden”说明是在锁屏或后台按的。 */
  function bindActions() {
    if (!('mediaSession' in navigator))
      return
    const actions: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => current().play()],
      ['pause', () => current().pause()],
      ['previoustrack', () => load(index - 1, '上一首按钮')],
      ['nexttrack', () => load(index + 1, '下一首按钮')],
      ['seekbackward', details => (current().currentTime = Math.max(0, current().currentTime - (details.seekOffset ?? 10)))],
      ['seekforward', details => (current().currentTime = Math.min(current().duration, current().currentTime + (details.seekOffset ?? 10)))],
      ['seekto', (details) => {
        if (details.seekTime !== undefined)
          current().currentTime = details.seekTime
      }],
      ['stop', () => current().pause()],
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
    const audio = current()
    position = audio.currentTime
    // 页面不可见时每 30 秒记一笔，证明锁屏、切到后台时还在放
    if (document.visibilityState === 'hidden' && !audio.paused && Date.now() - lastHiddenLog > 30_000) {
      lastHiddenLog = Date.now()
      logPage('play', '后台仍在放', { song: song.name, at: Math.round(audio.currentTime) })
    }
    const early = advance === 'early' || advance === 'overlap'
    if (!early || switching || audio.paused || !(audio.duration - audio.currentTime <= EARLY_S))
      return
    switching = true
    const run = advance === 'early' ? load(index + 1, '剩 1 秒时换歌') : overlapNext()
    run.finally(() => (switching = false))
  }

  function toggle() {
    const audio = current()
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
      logPage('play', document.visibilityState === 'hidden' ? '页面被隐藏' : '页面回到前台', { playing: !current().paused, at: Math.round(current().currentTime) })
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  })
</script>

<h1>后台播放、锁屏和通知栏控件</h1>

<section>
  <p>做法：点播放，然后切到别的 App、锁屏，等这首放完（第一首 2 分 45 秒），看能不能自动接着放下一首；在锁屏和通知栏上看封面，按暂停、下一首、上一首。回来后看记录。</p>
  <p>歌是不登录也能完整播放的免费歌，地址从网易云取。“换下一首的方式”决定换歌那一刻“正在播放”会不会断：</p>
  <p class='muted'>2026-10-10 在 Android 16 上：一首放完时 Chrome 交还音频焦点；在后台再申请会被系统拦下（Android 15 起的规则），歌就停了。放完再换的两种方式锁屏时最多接上一首。</p>
  <label>音质
    <select bind:value={level}>
      <option value='standard'>标准</option>
      <option value='exhigh'>极高</option>
      <option value='lossless'>无损（flac）</option>
    </select>
  </label>
  <label>换下一首的方式
    <select bind:value={advance}>
      {#each ADVANCES as [value, text] (value)}<option {value}>{text}</option>{/each}
    </select>
  </label>
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

{#each [0, 1] as slot (slot)}
  <audio
    bind:this={players[slot]}
    preload='auto'
    onplay={() => {
      if (slot !== active)
        return
      paused = false
      logPage('play', 'play 事件', { song: song.name, player: slot })
    }}
    onpause={() => {
      if (slot !== active)
        return
      paused = true
      logPage('play', 'pause 事件', { song: song.name, at: Math.round(players[slot]!.currentTime), player: slot })
    }}
    onended={() => {
      if (slot !== active)
        return
      logPage('play', '放完一首', { song: song.name, player: slot })
      load(index + 1, '上一首放完')
    }}
    onerror={() => logPage('play', 'audio 出错', { player: slot, code: players[slot]!.error?.code, message: players[slot]!.error?.message })}
    onstalled={() => slot === active && logPage('play', 'stalled', { song: song.name, at: Math.round(players[slot]!.currentTime) })}
    onloadedmetadata={() => {
      if (slot !== active)
        return
      duration = players[slot]!.duration
      setPosition()
    }}
    ontimeupdate={() => slot === active && onTimeUpdate()}
    onseeked={() => slot === active && setPosition()}
    onratechange={() => slot === active && setPosition()}
  ></audio>
{/each}

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
