<!--
  下载面板（#38）：桌面右侧浮动卡片、手机迷你播放条上方；逐首进度、速率、取消、重试，可收起成 44px 竖条 / 48px 横条。
  不是浮层栈里的一层（不压历史、不 inert 背景）；/downloads 不显示（那一页有完整的“正在下载”），离开后出现。
  开始下载先让提示条出来，160ms 后（从没有任务变成有任务）才飘入；用户收起过的，新任务不强行展开。
  一首下完不另起一行：这一行留在原位置，内容向右滑出露出成功层，停一下再整行向右退场，下方只补位一次；全部退完才写“已下载 N 首”，3 秒后收起（焦点在面板里时等焦点离开，最多 8 秒）。
  “全部取消”要在这条里再确认一次；打开不抢焦点，Esc 只在焦点在面板里时收起。
-->
<script lang='ts'>
  import { resolve } from '$app/paths'
  import { Check, ChevronDown, CircleAlert, Download, WifiOff } from '@lucide/svelte'
  import { onDestroy } from 'svelte'
  import { flip } from 'svelte/animate'

  import type { DownloadTask } from '#lib/app/downloads.js'

  import { getOverlays } from '../overlay/overlay-context'
  import { getAppView } from '../shared/app-context.svelte'
  import { desktopLayout } from '../shared/layout'
  import { float, reducedMotion } from '../shared/motion'
  import { DURATIONS } from '../shared/motion-tokens'
  import { formatCount } from '../shared/text'
  import Button from '../ui/Button.svelte'
  import IconButton from '../ui/IconButton.svelte'
  import TextButton from '../ui/TextButton.svelte'
  import { completedSince, LEAVING_HOLD_MS, leavingOf, panelOpensOn, panelRows, visiblePanelTasks } from './download-panel-core'
  import type { LeavingTask, PanelRow } from './download-panel-core'
  import DownloadLeavingRow from './DownloadLeavingRow.svelte'
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
  const taskCount = $derived(tasks.length)
  const hiddenCount = $derived(taskCount - rows.length)
  /** 完成项先留在列表原位置做退场，再移除；不要另起一行插进列表 */
  let leaving = $state<LeavingTask[]>([])
  const displayRows = $derived<PanelRow[]>(panelRows(rows, leaving))
  const current = $derived(tasks.find(task => task.status === 'downloading') ?? null)
  const currentId = $derived(current?.song.id ?? null)
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
  /** 完成态：已下载 N 首；0 是不在完成态 */
  let finishing = $state(0)
  let finishTimer: ReturnType<typeof setTimeout> | null = null
  let finishListener: ((event: FocusEvent) => void) | null = null
  /** 面板看着的时候下完了几首（完成态写它） */
  let completed = 0
  let lastFailed = 0
  /** 上一帧的任务，用来认出这一帧里下完的（任务已经不在表里，名字和进度得从上一帧拿） */
  let seen = new Map<number, DownloadTask>()
  let leavingTimers: ReturnType<typeof setTimeout>[] = []

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
    clearLeaving()
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

  const clearLeaving = (): void => {
    for (const timer of leavingTimers) clearTimeout(timer)
    leavingTimers = []
    leaving = []
  }

  const markFinished = (): void => {
    if (finishing > 0)
      return
    finishing = completed
    completed = 0
    announcement = `已下载 ${formatCount(finishing)} 首`
    panel.reveal()
    scheduleFinishHide()
  }

  const removeLeaving = (songId: number): void => {
    leaving = leaving.filter(item => item.songId !== songId)
    if (tasks.length > 0 || leaving.length > 0)
      return
    if (completed > 0)
      markFinished()
    else
      panel.hide()
  }

  /** 完成项留在原位置：内容先向右滑出露出成功层，停一下，再整行向右退场；下方只在这之后上移一次 */
  const startLeaving = (captured: DownloadTask): void => {
    const item = leavingOf(captured)
    if (leaving.some(each => each.songId === item.songId))
      return
    leaving = [
      ...leaving,
      item,
    ]
    leavingTimers.push(setTimeout(() => {
      leaving = leaving.map(each => each.songId === item.songId
        ? { ...each, phase: 'exit' }
        : each)
      leavingTimers.push(setTimeout(removeLeaving, DURATIONS['state-out'], item.songId))
    }, DURATIONS.state + LEAVING_HOLD_MS))
  }

  /** 这一帧里从任务表消失、又已经写进本机的：留在原位置做成功退场；最后一个退完才进完成态 */
  $effect(() => {
    const next = new Map(tasks.map(task => [task.song.id, task]))
    const done = completedSince([
      ...seen.keys(),
    ], [
      ...next.keys(),
    ], songId => view.state.downloads.has(songId))
    const finished = done
      .map(songId => seen.get(songId))
      .filter((task): task is DownloadTask => task !== undefined)
    seen = next
    if (done.length === 0 || panel.onDownloads)
      return
    completed += done.length
    for (const task of finished) {
      // 面板还没飘入就下完了：直接把面板打开，完成行也要看得见；收起态没有可看的行
      if (!panel.collapsed) {
        if (!panel.open)
          panel.reveal()
        startLeaving(task)
      }
    }
    if (next.size === 0 && leaving.length === 0) {
      // 收起态、或面板本来就没画：不播行退场，直接进完成态
      markFinished()
    }
  })

  /** 从没有任务变成有任务：先让提示条出来，160ms 后面板再飘入；收起过的不强行展开 */
  let lastSize = 0
  let lastOnDownloads = panel.onDownloads
  let initialized = false
  $effect(() => {
    const size = taskCount
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
      // 完成项还在退场：列表先别收，等它走完再决定完成态还是收起
      if (leaving.length > 0)
        return
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
    const songId = currentId
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
    clearLeaving()
    confirmAll = false
    panel.hide()
  }

  const resume = (): void => view.app.resumeDownloads()

  const collapsePanel = (): void => {
    confirmAll = false
    panel.collapse()
  }

  const onKeydown = (event: KeyboardEvent): void => {
    if (!shown || event.key !== 'Escape' || event.defaultPrevented || !panelEl?.contains(document.activeElement))
      return
    event.preventDefault()
    if (finishing > 0) {
      hideFinish()
      return
    }
    // 收起态就是入口：Esc 不把它藏掉，下载还没完时还能找回来；任务清空、完成态由面板自己收起
    if (!panel.collapsed)
      collapsePanel()
  }

  onDestroy(() => {
    stopFinish()
    for (const timer of leavingTimers)
      clearTimeout(timer)
  })
</script>

<svelte:window onkeydown={onKeydown} />

{#if shown}
  <div
    bind:this={panelEl}
    role='region'
    aria-label='下载'
    class={[
      'pointer-events-none fixed z-30',
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
    in:float={{ toward: 'left', distance: 24, panel: true }}
    out:float={{ toward: 'right', distance: 24, panel: true }}
  >
    <span class='sr-only' aria-live='polite'>{announcement}</span>
    {#if panel.collapsed}
      {#if desktop}
        <button
          type='button'
          class='pointer-events-auto relative w-11 flex flex-col items-center gap-1 rounded-full bg-white py-3 shadow-float'
          aria-label='展开下载面板'
          aria-expanded={false}
          onclick={() => panel.expand()}
        >
          {#if finishing > 0}
            <Check size={18} class='text-secondary-800' aria-hidden='true' />
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
          class='pointer-events-auto h-12 w-full flex items-center gap-2 rounded-xl bg-white px-3 shadow-float'
          aria-label='展开下载面板'
          aria-expanded={false}
          onclick={() => panel.expand()}
        >
          {#if finishing > 0}
            <Check size={16} class='flex-none text-secondary-800' aria-hidden='true' />
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
                : `${percent === null
                  ? ''
                  : `${percent}% · `}${formatCount(tasks.length)} 首`}
            </span>
            {#if speed && failed === 0 && !paused}
              <span class='flex-none text-caption text-neutral-600 tabular-nums'>{speed}</span>
            {/if}
          {/if}
        </button>
      {/if}
    {:else}
      <section class='pointer-events-auto max-h-full flex flex-col overflow-hidden rounded-xl bg-white shadow-float'>
        <header class='flex items-center gap-2 px-4 pb-2 pt-4'>
          {#if finishing > 0}
            <Check size={18} class='flex-none text-secondary-800' aria-hidden='true' />
            <h2 class='text-title-sm text-neutral-900 font-600'>已下载 {formatCount(finishing)} 首</h2>
          {:else}
            <h2 class='text-title-sm text-neutral-900 font-600'>{title}</h2>
            {#if tasks.length > 0}
              <span class='text-caption text-neutral-500 tabular-nums'>{formatCount(tasks.length)} 首</span>
            {/if}
            {#if speed}
              <span class='text-caption text-secondary-900 tabular-nums'>{speed}</span>
            {/if}
          {/if}
          <IconButton icon={ChevronDown} label='收起下载面板' class='ml-auto -mr-2' onclick={collapsePanel} />
        </header>
        {#if finishing === 0 && paused}
          <div class='flex items-center gap-2 pb-3 pl-4 pr-3'>
            <span class='text-caption text-neutral-600'>存储空间不够</span>
            <Button variant='download' class='ml-auto h-8 px-3 text-caption!' onclick={resume}>继续下载</Button>
          </div>
        {:else if finishing === 0 && !online}
          <div class='flex items-center gap-1.5 px-4 pb-3 text-caption text-neutral-600'>
            <WifiOff size={14} aria-hidden='true' />
            <span>离线时暂停下载</span>
          </div>
        {/if}
        {#if finishing === 0}
          <div class='min-h-0 flex-1 overflow-y-auto px-2'>
            {#each displayRows as row (row.key)}
              <div
                class='border-b border-neutral-100 last:border-0'
                animate:flip={{
                  duration: reducedMotion()
                    ? 0
                    : 200,
                }}
                out:float={{ toward: 'right', distance: 12 }}
              >
                {#if row.kind === 'leaving'}
                  <DownloadLeavingRow
                    name={row.leaving.name}
                    content={row.leaving.content}
                    phase={row.leaving.phase}
                    {paused}
                    {online}
                    {signedIn}
                  />
                {:else}
                  <DownloadTaskRow
                    task={row.task}
                    variant='panel'
                    {paused}
                    {online}
                    {signedIn}
                    speed={row.task.song.id === current?.song.id
                      ? speed
                      : null}
                    oncancel={() => view.app.cancelDownload(row.task.song.id)}
                    onretry={() => view.app.retryDownload(row.task.song.id)}
                  />
                {/if}
              </div>
            {/each}
          </div>
          <footer class='flex items-center gap-2 border-t border-neutral-100 px-4 py-2'>
            {#if hiddenCount > 0}
              <span class='text-caption text-neutral-500'>还有 {formatCount(hiddenCount)} 首</span>
            {/if}
            {#if confirmAll}
              <span class='text-caption text-neutral-700'>取消全部 {formatCount(tasks.length)} 首下载？</span>
              <TextButton size='caption' onclick={() => confirmAll = false}>取消</TextButton>
              <Button variant='destructive' class='ml-auto h-8 px-3 text-caption!' onclick={cancelEverything}>全部取消</Button>
            {:else}
              <TextButton size='caption' tone='neutral' onclick={() => confirmAll = true}>全部取消</TextButton>
              <TextButton href={resolve('/downloads')} size='caption' class='ml-auto'>查看已下载</TextButton>
            {/if}
          </footer>
        {:else}
          <div class='px-4 pb-3 pt-1'>
            <TextButton href={resolve('/downloads')} size='caption'>查看已下载</TextButton>
          </div>
        {/if}
      </section>
    {/if}
  </div>
{/if}
