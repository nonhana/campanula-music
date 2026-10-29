<!--
  正在下载的一行（#39，已下载页和下载面板共用）：排队、下载中（进度、速率）、失败（原因、重试），右边是取消。
  存储暂停、没登录、断网时写明为什么不动；不知道总大小时写已收到多少（#78）。
  page 是已下载页 56 / 64px 的网格；panel 是下载面板里的紧凑行。
-->
<script lang='ts'>
  import { CircleAlert, Clock, X } from '@lucide/svelte'

  import { songTitle } from '#lib/api/library.js'
  import type { DownloadTask } from '#lib/app/downloads.js'

  import { desktopLayout } from '../shared/layout'
  import { artistLine, formatMegabytes, langOf } from '../shared/text'
  import Cover from '../ui/Cover.svelte'
  import IconButton from '../ui/IconButton.svelte'
  import TextButton from '../ui/TextButton.svelte'
  import { downloadFailureText } from './view'

  const { task, variant, paused, online, signedIn, speed = null, readonly = false, oncancel, onretry }: {
    task: DownloadTask
    variant: 'page' | 'panel'
    paused: boolean
    online: boolean
    signedIn: boolean
    /** 面板里当前这首的速率（已经写好单位）；没有、暂停时是 null */
    speed?: string | null
    /** 完成退场时只保留封面、歌名和进度，不给操作 */
    readonly?: boolean
    oncancel: () => void
    onretry: () => void
  } = $props()

  const phone = $derived(!desktopLayout.current)
  /** 排着的那些为什么不动：存储暂停、还没登录（规则⑧）、断网（规则⑪） */
  const queuedLabel = $derived(paused
    ? '已暂停'
    : !signedIn
    ? '登录后继续'
    : !online
    ? '已暂停'
    : '排队中')
  const percent = $derived(task.total
    ? Math.floor(task.received * 100 / task.total)
    : null)
</script>

{#snippet status()}
  {#if task.status === 'downloading'}
    {#if paused || !online}
      <span class='text-neutral-600'>已暂停</span>
    {:else}
      <span class={[
        'h-1.5 flex-none overflow-hidden rounded-full bg-secondary-100',
        phone
          ? 'w-24'
          : 'w-32',
      ]}
            role='progressbar'
            aria-label='下载进度'
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent ?? undefined}
      >
        <span class='block h-full rounded-full bg-secondary-700' style:width='{percent ?? 0}%'></span>
      </span>
      <span class='whitespace-nowrap text-secondary-900 tabular-nums'>{percent === null
        ? `已收到 ${formatMegabytes(task.received)} MB`
        : `${percent}%`}</span>
      {#if speed}
        <span class='whitespace-nowrap text-caption text-neutral-600 tabular-nums'>{speed}</span>
      {/if}
    {/if}
  {:else if task.status === 'queued'}
    <Clock size={14} class='flex-none text-neutral-500' aria-hidden='true' />
    <span class='text-neutral-600'>{queuedLabel}</span>
  {:else}
    <CircleAlert size={14} class='flex-none text-error-700' aria-hidden='true' />
    <span class='truncate text-error-700' title={downloadFailureText(task.failure)}>下载失败：{downloadFailureText(task.failure)}</span>
  {/if}
{/snippet}

{#snippet actions()}
  {#if task.status === 'failed'}
    <TextButton
      strong
      class='md:h-8 md:px-3'
      disabled={!online || !signedIn}
      title={!online
        ? '离线时不能下载'
        : !signedIn
        ? '登录后才能下载'
        : undefined}
      aria-label={`重试下载《${songTitle(task.song)}》`}
      onclick={onretry}
    >重试</TextButton>
  {/if}
  <IconButton
    icon={X}
    label={task.status === 'failed'
      ? `不再下载：${songTitle(task.song)}`
      : `取消下载：${songTitle(task.song)}`}
    onclick={oncancel}
  />
{/snippet}

{#if variant === 'page'}
  <div class={[
    'grid h-full items-center',
    phone
      ? 'grid-cols-[48px_minmax(0,1fr)_auto] gap-3.5 pl-4 pr-3'
      : 'grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_96px] gap-4 pl-3 pr-2',
  ]}>
    <Cover url={task.song.album.coverUrl} size={phone
      ? 48
      : 40} class='rounded-lg' />
    <span class='min-w-0'>
      <span class={[
        'block truncate text-neutral-900 font-500',
        phone
          ? 'text-body'
          : 'text-label',
      ]} lang={langOf(songTitle(task.song))}>{songTitle(task.song)}</span>
      {#if phone}
        <span class='mt-1 min-w-0 flex items-center gap-2 text-caption'>{@render status()}</span>
      {:else}
        <span class='block truncate text-caption text-neutral-600' lang={langOf(artistLine(task.song))}>{artistLine(task.song)}</span>
      {/if}
    </span>
    {#if !phone}
      <span class='min-w-0 flex items-center gap-2.5 text-caption'>{@render status()}</span>
    {/if}
    {#if !readonly}
      <span class='flex items-center justify-end gap-1'>{@render actions()}</span>
    {/if}
  </div>
{:else}
  <div class='grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 py-2 pl-1 pr-1'>
    <Cover url={task.song.album.coverUrl} size={40} class='rounded-lg' />
    <span class='min-w-0'>
      <span class='block truncate text-label text-neutral-900 font-500' lang={langOf(songTitle(task.song))}>{songTitle(task.song)}</span>
      <span class='mt-0.5 min-w-0 flex items-center gap-2 text-caption'>{@render status()}</span>
    </span>
    {#if !readonly}
      <span class='flex items-center gap-1'>{@render actions()}</span>
    {/if}
  </div>
{/if}
