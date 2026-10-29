<!--
  设计系统页的下载面板卡片（不接 App）：和真实面板同一套标题、行、发丝线、底部操作；按钮由调用方决定做什么。
  真实面板的按钮接 App，这里只给静态示例和设计页的模拟下载用。
-->
<script lang='ts'>
  import { Check, ChevronDown } from '@lucide/svelte'
  import { flip } from 'svelte/animate'

  import type { DownloadTask } from '#lib/app/downloads.js'
  import { panelRows } from '#lib/components/downloads/download-panel-core.js'
  import type { LeavingTask, PanelRow } from '#lib/components/downloads/download-panel-core.js'
  import DownloadLeavingRow from '#lib/components/downloads/DownloadLeavingRow.svelte'
  import DownloadTaskRow from '#lib/components/downloads/DownloadTaskRow.svelte'
  import { reducedMotion } from '#lib/components/shared/motion.js'
  import Button from '#lib/components/ui/Button.svelte'
  import IconButton from '#lib/components/ui/IconButton.svelte'
  import TextButton from '#lib/components/ui/TextButton.svelte'

  const { tasks, leaving = [], paused = false, finishing = 0, speed = null, oncancel = () => {}, onretry = () => {}, oncollapse = () => {}, onresume = () => {}, onstop = () => {} }: {
    tasks: readonly DownloadTask[]
    leaving?: readonly LeavingTask[]
    paused?: boolean
    finishing?: number
    speed?: string | null
    oncancel?: (songId: number) => void
    onretry?: (songId: number) => void
    oncollapse?: () => void
    onresume?: () => void
    onstop?: () => void
  } = $props()

  const current = $derived(tasks.find(task => task.status === 'downloading') ?? null)
  const display = $derived<PanelRow[]>(panelRows(tasks, leaving))
</script>

<div class='max-w-full w-[360px] rounded-xl bg-white shadow-float'>
  <header class='flex items-center gap-2 px-4 pb-2 pt-4'>
    {#if finishing > 0}
      <Check size={18} class='flex-none text-secondary-800' aria-hidden='true' />
      <h2 class='text-title-sm text-neutral-900 font-600'>已下载 {finishing} 首</h2>
    {:else}
      <h2 class='text-title-sm text-neutral-900 font-600'>{paused
        ? '下载已暂停'
        : '正在下载'}</h2>
      {#if tasks.length > 0}
        <span class='text-caption text-neutral-500 tabular-nums'>{tasks.length} 首</span>
      {/if}
      {#if speed && !paused}
        <span class='text-caption text-secondary-900 tabular-nums'>{speed}</span>
      {/if}
    {/if}
    <IconButton icon={ChevronDown} label='收起下载面板' class='ml-auto -mr-2' onclick={oncollapse} />
  </header>
  {#if finishing === 0 && paused}
    <div class='flex items-center gap-2 pb-3 pl-4 pr-3'>
      <span class='text-caption text-neutral-600'>存储空间不够</span>
      <Button variant='download' class='ml-auto h-8 px-3 text-caption!' onclick={onresume}>继续下载</Button>
    </div>
  {/if}
  {#if finishing === 0}
    <div class='px-2'>
      {#each display as row (row.key)}
        <div
          class='border-b border-neutral-100 last:border-0'
          animate:flip={{
            duration: reducedMotion()
              ? 0
              : 200,
          }}
        >
          {#if row.kind === 'leaving'}
            <DownloadLeavingRow
              name={row.leaving.name}
              content={row.leaving.content}
              phase={row.leaving.phase}
              {paused}
              online
              signedIn
            />
          {:else}
            <DownloadTaskRow
              task={row.task}
              variant='panel'
              {paused}
              online
              signedIn
              speed={row.task.song.id === current?.song.id
                ? speed
                : null}
              oncancel={() => oncancel(row.task.song.id)}
              onretry={() => onretry(row.task.song.id)}
            />
          {/if}
        </div>
      {/each}
    </div>
    <footer class='flex items-center gap-2 border-t border-neutral-100 px-4 py-2'>
      <TextButton size='caption' tone='neutral' onclick={onstop}>全部取消</TextButton>
      <TextButton size='caption' class='ml-auto'>查看已下载</TextButton>
    </footer>
  {:else}
    <div class='px-4 pb-3 pt-1'>
      <TextButton size='caption'>查看已下载</TextButton>
    </div>
  {/if}
</div>
