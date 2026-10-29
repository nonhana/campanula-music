<!--
  设计系统页的“模拟开始下载”：不调 App 的下载、不联网、不写本机，只走真实的提示条、0.16 秒后飘入的面板、进度和完成态。
  位置、层级、提示条和面板的样子跟真实界面一致；可以试失败、暂停、单首取消和全部取消。
-->
<script lang='ts'>
  import { Play } from '@lucide/svelte'
  import { onDestroy } from 'svelte'

  import type { DownloadTask } from '#lib/app/downloads.js'
  import type { NoticeEntry } from '#lib/app/notice.js'
  import { LEAVING_HOLD_MS, leavingOf } from '#lib/components/downloads/download-panel-core.js'
  import type { LeavingTask } from '#lib/components/downloads/download-panel-core.js'
  import OperationNotice from '#lib/components/notice/OperationNotice.svelte'
  import { desktopLayout } from '#lib/components/shared/layout.js'
  import { DURATIONS } from '#lib/components/shared/motion-tokens.js'
  import { float } from '#lib/components/shared/motion.js'
  import Button from '#lib/components/ui/Button.svelte'
  import { designSong } from '#lib/dev/design-data.js'
  import DesignPanelCard from '#lib/dev/DesignPanelCard.svelte'

  /** 五首：长标题、日文、长英文、emoji、短名，方便看截断和换行 */
  const BATCH = [
    {
      song: designSong(1, '我还以为可以逃离', 'sansssss'),
      total: 9_200_000,
    },
    {
      song: designSong(2, 'この夜を超えて、君に会いに行くんだ。ずっと', '夜のあかり'),
      total: 4_400_000,
    },
    {
      song: designSong(3, 'WAVBACK (Extended Mix) [Remastered 2025]', 'sakanaausakana'),
      total: 12_600_000,
    },
    {
      song: designSong(4, '🎵 雨の日は、おうちでゆっくり音楽を聴こう 🌧️', '雨音'),
      total: 7_800_000,
    },
    {
      song: designSong(5, '短い', '小さい'),
      total: 2_100_000,
    },
  ] as const

  const SPEED = '1.2 MB/s'
  const TICKS_PER_SONG = 5
  const TICK_MS = 80

  let tasks = $state<DownloadTask[]>([])
  let leaving = $state<LeavingTask[]>([])
  let completed = $state(0)
  let phase = $state<'idle' | 'running' | 'done'>('idle')
  let paused = $state(false)
  let open = $state(false)
  let finishing = $state(0)
  let notice = $state<NoticeEntry | null>(null)
  let timers: ReturnType<typeof setTimeout>[] = []
  let ticker: ReturnType<typeof setInterval> | null = null

  const desktop = $derived(desktopLayout.current)
  /** 手机上面板占着底部时，提示条到顶上；桌面提示条固定在底部正中 */
  const place = $derived(desktop
    ? 'desktop'
    : open
    ? 'top'
    : 'bottom')
  const edge = $derived<'top' | 'bottom'>(place === 'top'
    ? 'top'
    : 'bottom')
  const current = $derived(tasks.find(task => task.status === 'downloading') ?? null)

  const clear = (): void => {
    for (const timer of timers) clearTimeout(timer)
    timers = []
    leaving = []
    if (ticker)
      clearInterval(ticker)
    ticker = null
  }

  const stop = (): void => {
    clear()
    tasks = []
    completed = 0
    phase = 'idle'
    paused = false
    open = false
    finishing = 0
    notice = null
  }

  const finish = (): void => {
    if (phase !== 'running')
      return
    phase = 'done'
    finishing = completed
    timers.push(setTimeout(stop, 3000))
  }

  const removeLeaving = (songId: number): void => {
    leaving = leaving.filter(item => item.songId !== songId)
    if (tasks.length > 0 || leaving.length > 0)
      return
    if (completed > 0)
      finish()
    else
      stop()
  }

  const startLeaving = (task: DownloadTask): void => {
    const item = leavingOf(task)
    if (leaving.some(each => each.songId === item.songId))
      return
    leaving = [
      ...leaving,
      item,
    ]
    timers.push(setTimeout(() => {
      leaving = leaving.map(each => each.songId === item.songId
        ? { ...each, phase: 'exit' }
        : each)
      timers.push(setTimeout(removeLeaving, DURATIONS['state-out'], item.songId))
    }, DURATIONS.state + LEAVING_HOLD_MS))
  }

  const activateNext = (): void => {
    if (paused || tasks.some(task => task.status === 'downloading'))
      return
    const next = tasks.find(task => task.status === 'queued')
    if (next) {
      tasks = tasks.map(task => task === next
        ? { ...task, status: 'downloading' }
        : task)
    }
  }

  const completeCurrent = (): void => {
    const active = current
    if (!active)
      return
    tasks = tasks.filter(task => task !== active)
    completed += 1
    startLeaving(active)
    activateNext()
  }

  const tick = (): void => {
    if (paused || phase !== 'running')
      return
    const active = current
    if (!active) {
      activateNext()
      return
    }
    const total = active.total ?? 0
    const received = Math.min(total, active.received + total / TICKS_PER_SONG)
    if (received >= total) {
      completeCurrent()
      return
    }
    tasks = tasks.map(task => task === active
      ? { ...task, received }
      : task)
  }

  const start = (): void => {
    clear()
    tasks = BATCH.map(({ song: item, total }) => ({
      status: 'queued',
      song: item,
      sources: [
        { kind: 'single' },
      ],
      received: 0,
      total,
    }))
    completed = 0
    phase = 'running'
    paused = false
    open = false
    finishing = 0
    notice = {
      id: -100,
      notice: {
        kind: 'downloadsAdded',
        queued: BATCH.length,
        downloaded: 0,
        trial: 0,
        noCopyright: 0,
      },
      actions: ['dismiss'],
      tone: 'success',
    }
    timers.push(setTimeout(() => notice = null, 4000))
    timers.push(setTimeout(() => open = true, 160))
    activateNext()
    ticker = setInterval(tick, TICK_MS)
  }

  const failCurrent = (): void => {
    const active = current
    if (!active)
      return
    tasks = tasks.map(task => task === active
      ? {
        ...task,
        status: 'failed',
        failure: { kind: 'interrupted' },
      }
      : task)
    activateNext()
  }

  const retry = (songId: number): void => {
    tasks = tasks.map(task => task.song.id === songId && task.status === 'failed'
      ? { ...task, status: 'queued', failure: undefined }
      : task)
    activateNext()
  }

  const cancel = (songId: number): void => {
    const wasActive = tasks.find(task => task.song.id === songId)?.status === 'downloading'
    tasks = tasks.filter(task => task.song.id !== songId)
    if (wasActive)
      activateNext()
    if (tasks.length === 0) {
      if (leaving.length > 0)
        return
      if (completed > 0)
        finish()
      else
        stop()
    }
    else if (!paused) {
      activateNext()
    }
  }

  const togglePause = (): void => {
    paused = !paused
    if (!paused)
      activateNext()
  }

  onDestroy(clear)
</script>

<div class='flex flex-wrap items-center gap-2'>
  <Button variant='primary' icon={Play} onclick={start} disabled={phase !== 'idle'}>模拟开始下载 {BATCH.length} 首</Button>
  {#if phase === 'running'}
    <Button variant='outline' onclick={failCurrent}>让当前这首失败</Button>
    <Button variant='outline' onclick={togglePause}>{paused
      ? '继续下载'
      : '模拟存储暂停'}</Button>
    <Button variant='outline' onclick={stop}>结束演示</Button>
  {/if}
</div>
<p class='mt-2 text-caption text-neutral-600'>不联网、不写本机。每首约 0.4 秒；可以试长标题截断、失败与重试、存储暂停、单首取消和全部取消。</p>

{#if notice}
  <div class={[
    'pointer-events-none fixed z-50 flex',
    place === 'desktop'
      ? 'bottom-24 left-1/2 max-w-[calc(100vw-48px)] -translate-x-1/2 flex-col items-center'
      : place === 'top'
      ? 'inset-x-2 top-16 flex-col'
      : 'inset-x-2 bottom-[calc(80px+env(safe-area-inset-bottom))] flex-col',
  ]}>
    <OperationNotice
      entry={notice}
      phone={!desktop}
      {edge}
      moved={false}
      onaction={() => notice = null}
    />
  </div>
{/if}

{#if open}
  <div
    class={[
      'pointer-events-none fixed z-30',
      desktop
        ? 'right-4 w-[360px]'
        : 'inset-x-2 bottom-[calc(80px+env(safe-area-inset-bottom))] max-h-[42dvh]',
    ]}
    style:top={desktop
      ? '80px'
      : undefined}
    in:float={{ toward: 'left', distance: 24, panel: true }}
    out:float={{ toward: 'right', distance: 24, panel: true }}
  >
    <div class='pointer-events-auto'>
      <DesignPanelCard
        {tasks}
        {leaving}
        {paused}
        {finishing}
        speed={current
          ? SPEED
          : null}
        oncollapse={stop}
        onstop={stop}
        onresume={togglePause}
        oncancel={cancel}
        onretry={retry}
      />
    </div>
  </div>
{/if}
