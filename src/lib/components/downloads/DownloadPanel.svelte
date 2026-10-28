<!--
  下载面板（#38）：桌面右侧浮动卡片、手机迷你播放条上方；逐首进度、速率、取消、重试，可收起成 44px 竖条 / 48px 横条。
  不是浮层栈里的一层（不压历史、不 inert 背景）；/downloads 不显示（那一页有完整的“正在下载”），离开后出现。
  开始下载先让提示条出来，160ms 后（从没有任务变成有任务）才飘入；用户收起过的，新任务不强行展开。
  一首下完先亮 ✓ 再退场；全部完成写“已下载 N 首”，3 秒后收起（焦点在面板里时等焦点离开，最多 8 秒）。
  “全部取消”要在这条里再确认一次；打开不抢焦点，Esc 只在焦点在面板里时收起。
-->
<script lang='ts'>
  import { resolve } from '$app/paths'
  import { Check, ChevronDown, CircleAlert, Download } from '@lucide/svelte'
  import { onDestroy } from 'svelte'
  import { flip } from 'svelte/animate'

  import { songTitle } from '#lib/api/library.js'

  import { getOverlays } from '../overlay/overlay-context'
  import { getAppView } from '../shared/app-context.svelte'
  import { desktopLayout } from '../shared/layout'
  import { fade, float, reducedMotion } from '../shared/motion'
  import { formatCount } from '../shared/text'
  import Button from '../ui/Button.svelte'
  import IconButton from '../ui/IconButton.svelte'
  import TextButton from '../ui/TextButton.svelte'
  import { completedSince, panelOpensOn, visiblePanelTasks } from './download-panel-core'
  import DownloadTaskRow from './DownloadTaskRow.svelte'
  import { bytesPerSecond, formatSpeed, SPEED_WINDOW_MS } from './speed'
  import type { SpeedSample } from './speed'

  const view = getAppView()
  const { downloadPanel: panel } = getOverlays()
  const desktop = $derived(desktopLayout.current)
  const downloads = $derived(view.state.downloads)
  const tasks = $derived([
    ...downloads.tasks.values(),
  ])
  const paused = $derived(downloads.paused !== null)
  const online = $derived(view.state.online)
  const signedIn = $derived(view.state.session.status === 'signedIn')
  /** 面板真的画出来：开着，又不在已下载页 */
  const shown = $derived(panel.open && !panel.onDownloads)
  const rows = $derived(visiblePanelTasks(tasks))
  const hiddenCount = $derived(tasks.length - rows.length)
  const current = $derived(tasks.find(task => task.status === 'downloading') ?? null)
  const failed = $derived(tasks.filter(task => task.status === 'failed').length)
  const percent = $derived(current?.total
    ? Math.floor(current.received * 100 / current.total)
    : null)
  const title = $derived(paused
    ? '下载已暂停'
    : failed > 0 && current === null
    ? '下载失败'
    : '正在下载')
  /** 桌面：顶栏 64px（断网时下面还有 36px 的提示条）+ 16px */
  const top = $derived(view.state.online
    ? 80
    : 116)
  const bottom = 'bottom-[calc(80px+env(safe-area-inset-bottom))]'

  let panelEl = $state<HTMLElement>()
  /** 读屏只在开始、完成、失败时更新；进度本身不念 */
  let announcement = $state('')
  let confirmAll = $state(false)
  /** 这一帧里下完、还在列表顶上的那一条（约 400ms） */
  let recent = $state<{ id: number, name: string } | null>(null)
  let recentTimer: ReturnType<typeof setTimeout> | null = null
  /** 完成态：已下载 N 首；0 是不在完成态 */
  let finishing = $state(0)
  let finishTimer: ReturnType<typeof setTimeout> | null = null
  let finishListener: ((event: FocusEvent) => void) | null = null
  /** 面板看着的时候下完了几首（完成态写它） */
  let completed = 0
  let lastFailed = 0
  /** 上一帧的任务编号，用来认出这一帧里下完的 */
  let seen: number[] = []

  const stopFinish = (): void => {
    if (finishTimer)
      clearTimeout(finishTimer)
    finishTimer = null
    if (finishListener)
      panelEl?.removeEventListener('focusout', finishListener)
    finishListener = null
  }

  const hideFinish = (): void => {
    stopFinish()
    panel.hide()
    finishing = 0
    announcement = ''
  }

  /** 3 秒后收起；焦点还在面板里时等它离开（最多 8 秒）。自动收起不抢焦点 */
  const scheduleFinishHide = (): void => {
    stopFinish()
    if (!panelEl?.contains(document.activeElement)) {
      finishTimer = setTimeout(() => {
        // 这 3 秒里焦点移进来了：改成等焦点离开
        if (panelEl?.contains(document.activeElement))
          scheduleFinishHide()
        else
          hideFinish()
      }, 3000)
      return
    }
    finishListener = (event) => {
      if (panelEl?.contains(event.relatedTarget as Node | null))
        return
      stopFinish()
      finishTimer = setTimeout(hideFinish, 0)
    }
    panelEl.addEventListener('focusout', finishListener)
    finishTimer = setTimeout(hideFinish, 8000)
  }

  /** 这一帧里从任务表消失、又已经写进本机的：记成完成，亮一下 ✓；最后一个下完就进完成态 */
  $effect(() => {
    const next = tasks.map(task => task.song.id)
    const names = new Map(tasks.map(task => [task.song.id, task.song]))
    const done = completedSince(seen, next, songId => view.state.downloads.has(songId))
    seen = next
    if (done.length === 0 || panel.onDownloads || !panel.open)
      return
    completed += done.length
    const last = done.at(-1)
    if (last !== undefined) {
      const song = names.get(last)
      recent = {
        id: last,
        name: song
          ? songTitle(song)
          : '',
      }
      if (recentTimer)
        clearTimeout(recentTimer)
      recentTimer = setTimeout(() => {
        recentTimer = null
        recent = null
      }, 400)
    }
    if (next.length === 0) {
      finishing = completed
      completed = 0
      announcement = `已下载 ${formatCount(finishing)} 首`
      scheduleFinishHide()
    }
  })

  /** 从没有任务变成有任务：先让提示条出来，160ms 后面板再飘入；收起过的不强行展开 */
  let lastSize = 0
  let lastOnDownloads = panel.onDownloads
  let initialized = false
  $effect(() => {
    const size = tasks.length
    const onDownloads = panel.onDownloads
    if (!initialized) {
      initialized = true
      lastSize = size
      lastOnDownloads = onDownloads
      if (size > 0 && !onDownloads) {
        panel.reveal()
        panel.collapse()
      }
      return
    }
    const leftDownloads = lastOnDownloads && !onDownloads
    lastOnDownloads = onDownloads
    if (size === 0) {
      lastSize = 0
      confirmAll = false
      if (finishing === 0) {
        completed = 0
        panel.hide()
      }
      return
    }
    if (onDownloads) {
      lastSize = size
      return
    }
    if (leftDownloads) {
      lastSize = size
      panel.reveal()
      return
    }
    if (panelOpensOn(lastSize, size)) {
      lastSize = size
      stopFinish()
      completed = 0
      finishing = 0
      announcement = `开始下载 ${formatCount(size)} 首`
      if (panel.collapsed) {
        panel.reveal()
        return
      }
      const timer = setTimeout(() => panel.expand(), 160)
      return () => clearTimeout(timer)
    }
    lastSize = size
  })

  /** 有新的失败就念一次；进度不动不念 */
  $effect(() => {
    if (failed > lastFailed)
      announcement = `${formatCount(failed)} 首下载失败`
    lastFailed = failed
  })

  /** 当前这首的速率：每 500ms 记一次已收到的字节，只看最近 3 秒；换歌、暂停、断网时重来 */
  let samples = $state<SpeedSample[]>([])
  $effect(() => {
    const songId = current?.song.id ?? null
    if (songId === null || paused || !online) {
      samples = []
      return
    }
    samples = []
    const timer = setInterval(() => {
      const live = view.state.downloads.tasks.get(songId)
      if (live?.status !== 'downloading')
        return
      const now = Date.now()
      samples = [
        ...samples.filter(sample => now - sample.at <= SPEED_WINDOW_MS),
        { at: now, received: live.received },
      ]
    }, 500)
    return () => clearInterval(timer)
  })
  const speed = $derived.by(() => {
    const bytes = bytesPerSecond(samples, Date.now(), SPEED_WINDOW_MS)
    return bytes > 0
      ? formatSpeed(bytes)
      : null
  })

  const cancelEverything = (): void => {
    view.app.cancelAllDownloads()
    confirmAll = false
    panel.hide()
  }

  const onKeydown = (event: KeyboardEvent): void => {
    if (!shown || event.key !== 'Escape' || event.defaultPrevented || !panelEl?.contains(document.activeElement))
      return
    event.preventDefault()
    if (finishing > 0) {
      hideFinish()
      return
    }
    if (panel.collapsed)
      panel.hide()
    else
      panel.collapse()
  }

  onDestroy(() => {
    stopFinish()
    if (recentTimer)
      clearTimeout(recentTimer)
  })
</script>

<svelte:window onkeydown={onKeydown} />

{#if shown}
  <div
    bind:this={panelEl}
    role='region'
    aria-label='下载'
    class={[
      'fixed z-30',
      desktop
        ? panel.collapsed
          ? 'right-4 w-11'
          : 'right-4 bottom-24 w-[360px]'
        : panel.collapsed
        ? `inset-x-2 ${bottom}`
        : `inset-x-2 ${bottom} max-h-[42dvh]`,
    ]}
    style:top={desktop
      ? `${top}px`
      : undefined}
    style:view-transition-name='download-panel'
    style:view-transition-class='still'
    transition:float={{ toward: 'left', distance: 24, panel: true }}
  >
    <span class='sr-only' aria-live='polite'>{announcement}</span>
    {#if panel.collapsed}
      {#if desktop}
        <button
          type='button'
          class='relative w-11 flex flex-col items-center gap-1 rounded-full bg-white py-3 shadow-float'
          aria-label='展开下载面板'
          aria-expanded={false}
          onclick={() => panel.expand()}
        >
          {#if finishing > 0}
            <Check size={18} class='text-primary-900' aria-hidden='true' />
            <span class='text-caption text-neutral-800 tabular-nums'>{formatCount(finishing)}</span>
            <span class='sr-only'>已下载 {formatCount(finishing)} 首</span>
          {:else}
            <Download size={18} class='text-secondary-900' aria-hidden='true' />
            <span class='text-caption text-neutral-800 tabular-nums'>{formatCount(tasks.length)}</span>
            {#if percent !== null}
              <span class='h-10 w-1 overflow-hidden rounded-full bg-secondary-100' aria-hidden='true'>
                <span class='block w-full rounded-full bg-secondary-700' style:height='{percent}%'></span>
              </span>
            {/if}
            {#if failed > 0}
              <span class='absolute size-2.5 rounded-full bg-error-700 -right-1 -top-1' aria-hidden='true'></span>
              <span class='sr-only'>有 {formatCount(failed)} 首下载失败</span>
            {/if}
          {/if}
        </button>
      {:else}
        <button
          type='button'
          class='h-12 w-full flex items-center gap-2 rounded-xl bg-white px-3 shadow-float'
          aria-label='展开下载面板'
          aria-expanded={false}
          onclick={() => panel.expand()}
        >
          {#if finishing > 0}
            <Check size={16} class='flex-none text-primary-900' aria-hidden='true' />
            <span class='min-w-0 flex-1 truncate text-caption text-neutral-800'>已下载 {formatCount(finishing)} 首</span>
          {:else}
            {#if failed > 0}
              <CircleAlert size={16} class='flex-none text-error-700' aria-hidden='true' />
            {:else}
              <Download size={16} class='flex-none text-secondary-900' aria-hidden='true' />
            {/if}
            <span class='min-w-0 flex-1 truncate text-caption text-neutral-800'>
              {failed > 0
                ? `下载失败 · ${formatCount(tasks.length)} 首`
                : paused
                ? `已暂停 · ${formatCount(tasks.length)} 首`
                : `下载中${percent === null
                  ? ''
                  : ` ${percent}%`} · ${formatCount(tasks.length)} 首`}
            </span>
            {#if speed && failed === 0 && !paused}
              <span class='flex-none text-caption text-neutral-600 tabular-nums'>{speed}</span>
            {/if}
          {/if}
        </button>
      {/if}
    {:else}
      <section class={[
        'flex flex-col overflow-hidden bg-white shadow-float',
        desktop
          ? 'max-h-full rounded-2xl'
          : 'max-h-full rounded-xl',
      ]}>
        <header class='flex items-center gap-2 px-4 pb-2 pt-3'>
          {#if finishing > 0}
            <Check size={18} class='flex-none text-primary-900' aria-hidden='true' />
            <h2 class='text-label text-neutral-900 font-600'>已下载 {formatCount(finishing)} 首</h2>
          {:else}
            <h2 class='text-label text-neutral-900 font-600'>{title}</h2>
            <span class='text-caption text-neutral-500 tabular-nums'>{formatCount(tasks.length)} 首</span>
            {#if speed}
              <span class='text-caption text-neutral-600 tabular-nums'>{speed}</span>
            {/if}
          {/if}
          <IconButton icon={ChevronDown} label='收起下载面板' class='ml-auto' onclick={() => panel.collapse()} />
        </header>
        {#if finishing === 0}
          <div class='min-h-0 flex-1 overflow-y-auto px-2'>
            {#if recent}
              <div
                class='flex items-center gap-2 px-2 py-2 text-caption text-primary-900'
                in:fade
                out:float={{ toward: 'right', distance: 12 }}
              >
                <Check size={16} class='flex-none' aria-hidden='true' />
                <span class='truncate'>已下载《{recent.name}》</span>
              </div>
            {/if}
            {#each rows as task (task.song.id)}
              <div animate:flip={{
                duration: reducedMotion()
                  ? 0
                  : 200,
              }}>
                <DownloadTaskRow
                  {task}
                  variant='panel'
                  {paused}
                  {online}
                  {signedIn}
                  speed={task.song.id === current?.song.id
                    ? speed
                    : null}
                  oncancel={() => view.app.cancelDownload(task.song.id)}
                  onretry={() => view.app.retryDownload(task.song.id)}
                />
              </div>
            {/each}
          </div>
          <footer class='flex items-center gap-2 px-4 py-2'>
            {#if hiddenCount > 0}
              <span class='text-caption text-neutral-500'>还有 {formatCount(hiddenCount)} 首</span>
            {/if}
            {#if confirmAll}
              <span class='text-caption text-neutral-700'>取消全部 {formatCount(tasks.length)} 首下载？</span>
              <TextButton size='caption' onclick={() => confirmAll = false}>取消</TextButton>
              <Button variant='destructive' class='ml-auto h-8 px-3 text-caption!' onclick={cancelEverything}>全部取消</Button>
            {:else}
              <TextButton size='caption' tone='neutral' onclick={() => confirmAll = true}>全部取消</TextButton>
              <a href={resolve('/downloads')} class='ml-auto text-caption text-primary-900 font-500'>查看已下载</a>
            {/if}
          </footer>
        {:else}
          <div class='px-4 pb-3'>
            <a href={resolve('/downloads')} class='text-caption text-primary-900 font-500'>查看已下载</a>
          </div>
        {/if}
      </section>
    {/if}
  </div>
{/if}
