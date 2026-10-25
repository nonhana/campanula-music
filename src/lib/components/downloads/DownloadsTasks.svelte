<!--
  已下载页的“正在下载”（#39，原型 DownloadsTasks）：排队、下载中（进度）、失败（写明原因、可重试）。
  存储空间不够时整队暂停（规则⑪），这里一直有“继续下载”，不靠一条会消失的提示；离线时写明暂停、重试不可用。
  队列可能很长（整张歌单、几千首），和歌曲列表一样只渲染看得见的行。
-->
<script lang='ts'>
  import { CircleAlert, Clock, WifiOff } from '@lucide/svelte'

  import { songTitle } from '#lib/api/library.js'
  import type { DownloadTask } from '#lib/app/downloads.js'

  import { getAppView } from '../shared/app-context.svelte'
  import { desktopLayout } from '../shared/layout'
  import { artistLine, formatCount, langOf } from '../shared/text'
  import Button from '../ui/Button.svelte'
  import Cover from '../ui/Cover.svelte'
  import TextButton from '../ui/TextButton.svelte'
  import VirtualList from '../ui/VirtualList.svelte'
  import { downloadFailureText } from './view'

  const view = getAppView()
  const phone = $derived(!desktopLayout.current)
  /** 只在下载状态真的换了时重算；播放进度之类的发布不动这张表 */
  const downloads = $derived(view.state.downloads)
  const tasks = $derived([
    ...downloads.tasks.values(),
  ])
  const paused = $derived(downloads.paused !== null)
  const online = $derived(view.state.online)
  const signedIn = $derived(view.state.session.status === 'signedIn')
  /** 排着的那些为什么不动：存储暂停、还没登录（规则⑧）、断网（规则⑪） */
  const queuedLabel = $derived(paused
    ? '已暂停'
    : !signedIn
    ? '登录后继续'
    : !online
    ? '已暂停'
    : '排队中')

  const percentOf = (task: DownloadTask): number | null => task.total
    ? Math.floor(task.received * 100 / task.total)
    : null
</script>

{#snippet status(task: DownloadTask)}
  {#if task.status === 'downloading'}
    {#if paused || !online}
      <span class='text-neutral-600'>已暂停</span>
    {:else}
      {@const percent = percentOf(task)}
      <span class={[
        'h-1.5 flex-none overflow-hidden rounded-full bg-secondary-100',
        phone
          ? 'w-24'
          : 'w-32',
      ]} aria-hidden='true'>
        <span class='block h-full rounded-full bg-secondary-700' style:width='{percent ?? 0}%'></span>
      </span>
      <span class='text-secondary-900 tabular-nums'>{percent === null
        ? '下载中'
        : `下载中 ${percent}%`}</span>
    {/if}
  {:else if task.status === 'queued'}
    <Clock size={14} class='flex-none text-neutral-500' aria-hidden='true' />
    <span class='text-neutral-600'>{queuedLabel}</span>
  {:else}
    <CircleAlert size={14} class='flex-none text-error-700' aria-hidden='true' />
    <span class='truncate text-error-700' title={downloadFailureText(task.failure)}>下载失败：{downloadFailureText(task.failure)}</span>
  {/if}
{/snippet}

{#snippet taskRow(task: DownloadTask)}
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
        <span class='mt-1 min-w-0 flex items-center gap-2 text-caption'>{@render status(task)}</span>
      {:else}
        <span class='block truncate text-caption text-neutral-600' lang={langOf(artistLine(task.song))}>{artistLine(task.song)}</span>
      {/if}
    </span>
    {#if !phone}
      <span class='min-w-0 flex items-center gap-2.5 text-caption'>{@render status(task)}</span>
    {/if}
    <span class='flex justify-end'>
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
          onclick={() => view.app.retryDownload(task.song.id)}
        >重试</TextButton>
      {/if}
    </span>
  </div>
{/snippet}

{#if tasks.length > 0}
  <section class={phone
    ? 'pt-5'
    : 'mt-8'}>
    <div class={[
      'flex flex-wrap items-center gap-2',
      phone
        ? 'px-4 pb-1'
        : 'mb-3',
    ]}>
      <h2 class={[
        'text-neutral-900 font-600',
        phone
          ? 'text-title-sm'
          : 'text-title',
      ]}>正在下载</h2>
      <span class='text-label text-neutral-500 tabular-nums'>{formatCount(tasks.length)} 首</span>
      {#if paused}
        <span class='ml-auto text-caption text-neutral-700'>存储空间不够，已暂停</span>
        <Button variant='download' class='px-4 md:h-9 text-caption!' onclick={() => view.app.resumeDownloads()}>继续下载</Button>
      {:else if !signedIn}
        <span class='ml-auto text-caption text-neutral-700'>登录后继续下载</span>
      {:else if !online}
        <span class='ml-auto inline-flex items-center gap-1.5 text-caption text-neutral-600'>
          <WifiOff size={14} aria-hidden='true' />离线时暂停下载
        </span>
      {/if}
    </div>
    <div role='group' aria-label='正在下载的歌曲' class={phone
      ? ''
      : 'rounded-2xl bg-white p-2 shadow-ambient'}>
      <VirtualList
        items={tasks}
        itemHeight={phone
          ? 64
          : 56}
        getKey={(task: DownloadTask) => task.song.id}
        row={taskRow}
      />
    </div>
  </section>
{/if}
