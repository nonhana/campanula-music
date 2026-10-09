<script lang='ts'>
  import type { BgItem, RelayPlan } from '$lib/probe/download'
  import type { Level } from '$lib/probe/netease'
  import { DOWNLOAD_CACHE, downloadKey, redirectUrl, startBgFetch, startRelayStep } from '$lib/probe/download'
  import { errorText, kvGet, kvSet, logPage } from '$lib/probe/log'
  import LogView from '$lib/probe/LogView.svelte'
  import { downloadUrl } from '$lib/probe/netease'
  import { songName, SONGS } from '$lib/probe/songs'
  import { onMount } from 'svelte'

  interface TaskView {
    id: string
    downloaded: number
    downloadTotal: number
    result: string
    failureReason: string
  }

  interface Saved {
    id: number
    name: string
    bytes: number
    expected?: number
    at: number
    reg: string
  }

  let manager = $state<BackgroundFetchManager | null>(null)
  let checked = $state(false)
  let level = $state<Level>('lossless')
  let count = $state(3)
  let busy = $state(false)
  let message = $state('')
  let tasks = $state<TaskView[]>([])
  let saved = $state<Saved[]>([])
  let relay = $state<RelayPlan | null>(null)
  let player: HTMLAudioElement
  let playingUrl = ''

  const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`
  const picked = $derived(SONGS.slice(0, count))
  const note = (kind: string, detail?: unknown) => logPage('download', kind, detail)

  /** 先取一遍地址，拿到每首的大小（downloadTotal 要用）；经服务器跳转时，后台任务里用的是跳转地址。 */
  async function getItems(viaServer: boolean): Promise<BgItem[]> {
    const items: BgItem[] = []
    for (const song of picked) {
      const url = await downloadUrl(song.id, level)
      items.push({ id: song.id, url: viaServer ? redirectUrl(location.origin, song.id, level) : url.url, size: url.size, type: url.type })
    }
    return items
  }

  /**
   * 一批：一个后台任务下全部。
   * - 先取好地址：直接下网易云的地址；排在后面的歌开始下时，地址可能已过期（约 20 分钟）。
   * - 经服务器跳转：每首先到服务器，服务器当场取地址再跳转过去。
   */
  async function startBatch(viaServer: boolean) {
    if (!manager)
      return
    busy = true
    message = '正在取下载地址…'
    const mode = viaServer ? '经服务器跳转' : '先取好地址'
    try {
      const items = await getItems(viaServer)
      const regId = `batch-${Date.now()}`
      await startBgFetch(manager, regId, items, `一批 ${items.length} 首（${mode}）`, note)
      message = `已开始：${regId}（${items.length} 首，${mb(items.reduce((sum, item) => sum + item.size, 0))}，${mode}）`
      await logPage('download', '开始一批', { regId, mode, songs: items.map(item => songName(item.id)), bytes: items.map(item => item.size), level })
    }
    catch (error) {
      message = errorText(error)
      await logPage('download', '开始一批失败', { mode, error: errorText(error) })
    }
    finally {
      busy = false
      await refresh()
    }
  }

  /** 接力：从页面开第一棒，之后每一棒由 Service Worker 在上一棒完成时开。 */
  async function startRelay() {
    if (!manager)
      return
    busy = true
    message = '正在取第一首的下载地址…'
    try {
      const plan: RelayPlan = { planId: `relay-${Date.now()}`, ids: picked.map(song => song.id), level, index: 0, regId: '' }
      const first = await startRelayStep(manager, plan, 0, note)
      message = `已开始接力：第一棒 ${first.regId}`
      await logPage('download', '开始接力', { planId: plan.planId, songs: plan.ids.map(songName), level })
    }
    catch (error) {
      message = errorText(error)
      await logPage('download', '开始接力失败', errorText(error))
    }
    finally {
      busy = false
      await refresh()
    }
  }

  async function stopRelay() {
    await kvSet('relay', null)
    await logPage('download', '停止接力（不再开下一棒）')
    await refresh()
  }

  async function abort(id: string) {
    const registration = await manager?.get(id)
    const ok = await registration?.abort()
    await logPage('download', '页面取消后台任务', { id, ok })
    await refresh()
  }

  async function refresh() {
    if (manager) {
      const ids = await manager.getIds()
      const registrations = await Promise.all(ids.map(id => manager!.get(id)))
      tasks = registrations.flatMap(registration => registration
        ? [{ id: registration.id, downloaded: registration.downloaded, downloadTotal: registration.downloadTotal, result: registration.result, failureReason: registration.failureReason }]
        : [])
    }
    relay = await kvGet<RelayPlan | null>('relay') ?? null
    const cache = await caches.open(DOWNLOAD_CACHE)
    const list: Saved[] = []
    for (const request of await cache.keys()) {
      const response = await cache.match(request)
      const id = Number(new URL(request.url).pathname.split('/').pop())
      const reg = response?.headers.get('x-probe-reg') ?? ''
      const items = await kvGet<BgItem[]>(`bg:${reg}`)
      list.push({
        id,
        name: songName(id),
        bytes: Number(response?.headers.get('x-probe-bytes') ?? 0),
        expected: items?.find(item => item.id === id)?.size,
        at: Number(response?.headers.get('x-probe-at') ?? 0),
        reg,
      })
    }
    saved = list.sort((a, b) => a.at - b.at)
  }

  /** 从本机缓存放一首，确认存下的是能播的完整音频。 */
  async function playSaved(id: number) {
    const response = await caches.match(downloadKey(id), { cacheName: DOWNLOAD_CACHE })
    if (!response)
      return
    if (playingUrl)
      URL.revokeObjectURL(playingUrl)
    playingUrl = URL.createObjectURL(await response.blob())
    player.src = playingUrl
    try {
      await player.play()
      await logPage('download', '从本机放下载的歌', { song: songName(id) })
    }
    catch (error) {
      await logPage('download', '下载的歌放不了', { song: songName(id), error: errorText(error) })
    }
  }

  async function clearSaved() {
    await caches.delete(DOWNLOAD_CACHE)
    await logPage('download', '清空下载')
    await refresh()
  }

  onMount(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    ;(async () => {
      const registration = await navigator.serviceWorker?.ready
      manager = registration?.backgroundFetch ?? null
      checked = true
      await refresh()
      timer = setInterval(() => {
        if (document.visibilityState === 'visible')
          refresh()
      }, 1000)
    })()
    window.addEventListener('probe-log', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('probe-log', refresh)
      if (playingUrl)
        URL.revokeObjectURL(playingUrl)
    }
  })
</script>

<h1>后台下载（Background Fetch）</h1>

<section>
  <p>做法：选好首数，点下面一种方式，看到通知栏出现下载进度后，从最近任务里划掉探针 App。等通知栏显示完成（或不再动），再打开探针看记录和“下载好的歌”。</p>
  <ul>
    <li><strong>一批 · 先取好地址</strong>：先取好所有歌的网易云地址，一个后台任务下全部。地址约 20 分钟过期，排在后面的歌可能来不及。</li>
    <li><strong>一批 · 经服务器跳转</strong>：一个后台任务下全部，但每首先到 Campanula 服务器，服务器当场取地址再跳转到网易云。</li>
    <li><strong>接力</strong>：一首一个后台任务；上一首完成时，由 Service Worker 现取下一首的地址、开下一个任务。桌面 Chrome 不允许在 Service Worker 里开后台任务，这里在手机上再确认一次。</li>
  </ul>
  <p class='muted'>记录里 Service Worker 那几条的“没有窗口”，说明当时 App 已经关掉。歌是不登录也能下完整音频的免费歌，无损每首约 24–34 MB。</p>
</section>

<section>
  {#if !checked}
    <p>正在检查…</p>
  {:else if !manager}
    <p class='error'>这个浏览器没有 Background Fetch（Service Worker 的 registration.backgroundFetch 不存在）。</p>
  {:else}
    <label>音质
      <select bind:value={level}>
        <option value='exhigh'>极高（mp3）</option>
        <option value='lossless'>无损（flac）</option>
      </select>
    </label>
    <label>首数
      <select bind:value={count}>
        {#each [1, 2, 3, 4, 5, 6] as n (n)}<option value={n}>{n}</option>{/each}
      </select>
    </label>
    <div class='row'>
      <button type='button' onclick={() => startBatch(false)} disabled={busy}>一批 · 先取好地址</button>
      <button type='button' onclick={() => startBatch(true)} disabled={busy}>一批 · 经服务器跳转</button>
      <button type='button' onclick={startRelay} disabled={busy}>接力</button>
    </div>
    <p>{message}</p>
  {/if}
</section>

<section>
  <h2>进行中的后台任务</h2>
  {#if tasks.length === 0}
    <p class='muted'>没有。</p>
  {/if}
  {#each tasks as task (task.id)}
    <div class='task'>
      <div><strong>{task.id}</strong> · {mb(task.downloaded)} / {mb(task.downloadTotal)} {task.result ? `· ${task.result}` : ''} {task.failureReason ? `· ${task.failureReason}` : ''}</div>
      <progress max={task.downloadTotal || 1} value={task.downloaded}></progress>
      <button type='button' onclick={() => abort(task.id)}>取消</button>
    </div>
  {/each}
  {#if relay}
    <p>接力计划 {relay.planId}：第 {relay.index + 1}/{relay.ids.length} 棒（{songName(relay.ids[relay.index]!)}）</p>
    <button type='button' onclick={stopRelay}>停止接力</button>
  {/if}
</section>

<section>
  <h2>下载好的歌（{saved.length} 首）</h2>
  {#if saved.length === 0}
    <p class='muted'>还没有。</p>
  {/if}
  <ol>
    {#each saved as item (item.id)}
      <li>
        <strong>{item.name}</strong> · {mb(item.bytes)}
        {#if item.expected !== undefined}<span class={item.bytes === item.expected ? 'ok' : 'error'}>{item.bytes === item.expected ? '大小一致' : `应为 ${item.expected} 字节`}</span>{/if}
        <div class='muted'>{new Date(item.at).toLocaleTimeString('zh-CN', { hour12: false })} 存下 · {item.reg}</div>
        <button type='button' onclick={() => playSaved(item.id)}>从本机放</button>
      </li>
    {/each}
  </ol>
  <audio bind:this={player} controls></audio>
  <button type='button' onclick={clearSaved} disabled={saved.length === 0}>清空下载</button>
</section>

<LogView topic='download' />

<style>
  .row {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  .task {
    margin: 8px 0;
  }
  progress {
    width: 100%;
  }
  audio {
    width: 100%;
    margin: 8px 0;
  }
  ol {
    padding-left: 20px;
  }
  li {
    margin: 8px 0;
  }
  .ok {
    color: #206f52;
  }
  .muted {
    color: #4b5563;
  }
</style>
