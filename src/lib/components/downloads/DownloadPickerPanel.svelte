<!--
  下载选择器的内容（#39）：列当前歌单 / 专辑的歌，默认勾上所有能下载的；已下载、排队中、试听、无版权各自写明并禁用。
  桌面和手机都是同一个列表；筛选只筛当前页，不发请求。底部写已选首数和按网易云歌曲信息估的合计大小，
  空间不够的提示交给下载队列（存不下时整队暂停），这里不假装知道硬盘还剩多少。
  歌单还没同步完时，已加载的可下载歌全选才保留“同步完补上剩下的”；只挑一部分就不补。
-->
<script lang='ts'>
  import { Check, CircleArrowDown, ListMusic, SearchX } from '@lucide/svelte'
  import { SvelteMap } from 'svelte/reactivity'

  import type { Song } from '#lib/api/library.js'
  import { playlistName, songTitle } from '#lib/api/library.js'
  import type { DownloadBlock, DownloadStartBlock } from '#lib/app/downloads.js'

  import { getOverlays } from '../overlay/overlay-context'
  import type { DownloadPickerRequest } from '../overlay/overlay-requests'
  import { getAppView } from '../shared/app-context.svelte'
  import { artistLine, formatCount, formatMegabytes, langOf } from '../shared/text'
  import SkeletonRows from '../songs/SkeletonRows.svelte'
  import { SONG_ROW_HEIGHT } from '../songs/view'
  import Button from '../ui/Button.svelte'
  import Cover from '../ui/Cover.svelte'
  import Scrollbar from '../ui/Scrollbar.svelte'
  import SearchField from '../ui/SearchField.svelte'
  import StateBlock from '../ui/StateBlock.svelte'
  import TextButton from '../ui/TextButton.svelte'
  import VirtualList from '../ui/VirtualList.svelte'

  const { request, sheet }: { request: DownloadPickerRequest, sheet: boolean } = $props()

  const view = getAppView()
  const { downloadPicker } = getOverlays()
  const library = $derived(view.state.library)
  const playlist = $derived(request.kind === 'playlist'
    ? library?.playlistPage(request.playlistId) ?? null
    : null)
  const album = $derived(request.kind === 'album'
    ? library?.albumPage(request.albumId) ?? null
    : null)
  const content = $derived(playlist?.content
    ?? (album?.status === 'shown'
      ? album.content
      : null))
  const songs = $derived(content?.songs ?? [])
  const name = $derived(request.kind === 'playlist'
    ? playlist
      ? playlistName({ name: playlist.info?.name ?? null, kind: playlist.kind })
      : ''
    : album?.status === 'shown'
    ? album.content.album.name ?? '未知专辑'
    : '')
  const loading = $derived(songs.length === 0 && content === null)
  const incomplete = $derived(request.kind === 'playlist' && playlist?.content !== null && playlist?.content !== undefined
    ? !playlist.content.complete
    : false)
  const remaining = $derived(playlist?.count
    ? Math.max(0, playlist.count.total - songs.length)
    : null)

  let query = $state('')
  let scroller = $state<HTMLElement>()
  let failure = $state<DownloadStartBlock | null>(null)
  const selected = new SvelteMap<number, Song>()
  /** 打开后只补一次默认勾选；之后同步进来的新歌留给用户自己勾 */
  let initialized = $state(false)

  const blockOf = (song: Song): DownloadBlock | null => view.state.downloadBlock(song)
  const sizeOf = (song: Song): number | null => song.downloadSize ?? (song.duration === null
    ? null
    : Math.round(song.duration * 40))

  const term = $derived(query.trim().toLowerCase())
  const filtered = $derived(term
    ? songs.filter(song => [
      songTitle(song),
      artistLine(song),
      song.album.name ?? '',
    ].some(text => text.toLowerCase().includes(term)))
    : songs)
  const selectable = $derived(songs.filter(song => blockOf(song) === null))
  const selectableShown = $derived(filtered.filter(song => blockOf(song) === null))
  const chosen = $derived(songs.filter(song => selected.has(song.id) && blockOf(song) === null))
  const allShownSelected = $derived(selectableShown.length > 0 && selectableShown.every(song => selected.has(song.id)))
  const fill = $derived(selectable.length > 0 && selectable.every(song => selected.has(song.id)))
  const total = $derived(chosen.reduce((sum, song) => sum + (sizeOf(song) ?? 0), 0))
  const unknown = $derived(chosen.some(song => sizeOf(song) === null))
  const sizeText = $derived.by(() => {
    if (chosen.length === 0)
      return ''
    if (total === 0 && unknown)
      return '大小未知'
    return `共约 ${formatMegabytes(total)} MB${unknown
      ? '（部分未知）'
      : ''}`
  })

  const STATUS: Record<DownloadBlock, string> = {
    downloaded: '已下载',
    queued: '排队中',
    downloading: '下载中',
    trial: '试听',
    noCopyright: '无版权',
    signedOut: '登录后下载',
    offline: '离线时不能下载',
  }

  // 下载列表晚一点读出来时，默认勾选会跟着数据再来一次；只补一次
  $effect.pre(() => {
    if (initialized || songs.length === 0)
      return
    for (const song of songs) {
      if (blockOf(song) === null)
        selected.set(song.id, song)
    }
    initialized = true
  })

  const toggle = (song: Song): void => {
    if (blockOf(song) !== null || downloadPicker.busy)
      return
    if (selected.has(song.id))
      selected.delete(song.id)
    else
      selected.set(song.id, song)
  }

  const toggleAll = (): void => {
    if (downloadPicker.busy)
      return
    if (allShownSelected) {
      for (const song of selectableShown)
        selected.delete(song.id)
    }
    else {
      for (const song of selectableShown)
        selected.set(song.id, song)
    }
  }

  const submit = async (): Promise<void> => {
    if (downloadPicker.busy || chosen.length === 0)
      return
    downloadPicker.setBusy(true)
    failure = null
    try {
      const outcome = request.kind === 'playlist'
        ? await view.app.downloadPlaylist(request.playlistId, chosen, { fill })
        : await view.app.downloadAlbum(request.albumId, chosen)
      if (outcome === 'signedOut' || outcome === 'offline') {
        failure = outcome
        return
      }
      downloadPicker.close()
    }
    finally {
      downloadPicker.setBusy(false)
    }
  }
</script>

{#snippet checkbox(checked: boolean, disabled: boolean)}
  <span
    class={[
      'grid size-[22px] flex-none place-items-center rounded-md border-[1.5px]',
      disabled
        ? 'border-neutral-200 bg-neutral-200 text-neutral-500'
        : checked
        ? 'border-primary-900 bg-primary-900 text-white'
        : 'border-neutral-500 bg-white',
    ]}
    aria-hidden='true'
  >
    {#if checked}<Check size={14} strokeWidth={3} />{/if}
  </span>
{/snippet}

{#snippet songRow(song: Song)}
  {@const block = blockOf(song)}
  {@const checked = block === 'downloaded' || selected.has(song.id)}
  <button
    type='button'
    role='checkbox'
    aria-checked={checked}
    aria-disabled={block !== null}
    class='h-full w-full flex items-center gap-3 pl-4 pr-3 text-left outline-none focus-visible:bg-primary-100 enabled:active:bg-primary-50'
    onclick={() => toggle(song)}
  >
    {@render checkbox(checked, block !== null)}
    <Cover url={song.album.coverUrl} size={40} class='rounded-md' />
    <span class='min-w-0 flex-1'>
      <span class='block truncate text-body text-neutral-900 font-500' lang={langOf(song.name)}>{songTitle(song)}</span>
      <span class='block truncate text-caption text-neutral-600' lang={langOf(artistLine(song))}>{artistLine(song)}</span>
    </span>
    {#if block}
      <span class={[
        'flex-none text-caption tabular-nums',
        block === 'trial' || block === 'noCopyright'
          ? 'text-warning-800'
          : 'text-neutral-500',
      ]}>{STATUS[block]}</span>
    {:else}
      <span class='flex-none text-caption text-neutral-500 tabular-nums'>{sizeOf(song) === null
        ? '—'
        : `${formatMegabytes(sizeOf(song) ?? 0)} MB`}</span>
    {/if}
  </button>
{/snippet}

{#if sheet && name}
  <p class='truncate px-4 pb-1 text-caption text-neutral-600' lang={langOf(name)}>「{name}」</p>
{/if}
<div class='px-4 pb-3'>
  <SearchField label='筛选歌曲' bind:value={query} data-autofocus />
  <p class='mt-2 min-h-4 px-1 text-caption text-neutral-600 tabular-nums' role='status'>
    {#if term && !loading}
      找到 {formatCount(filtered.length)} 首
    {:else if !loading}
      共 {formatCount(songs.length)} 首{incomplete
        ? ' · 还有歌没同步完'
        : ''}
    {/if}
  </p>
</div>
<div bind:this={scroller} class='min-h-0 flex-1 overflow-y-auto overscroll-contain'>
  <Scrollbar />
  {#if loading}
    <SkeletonRows count={6} label='正在加载可下载的歌' />
  {:else if songs.length === 0}
    <StateBlock kind='empty' icon={ListMusic} title={request.kind === 'playlist'
      ? '这张歌单还没有歌'
      : '这张专辑还没有歌'} />
  {:else if filtered.length === 0}
    <StateBlock kind='empty' icon={SearchX} title={`没有找到“${query.trim()}”`} />
  {:else}
    <VirtualList items={filtered} itemHeight={SONG_ROW_HEIGHT} getKey={(song: Song) => song.id} scrollParent={scroller}>
      {#snippet row(song: Song)}{@render songRow(song)}{/snippet}
    </VirtualList>
  {/if}
</div>
<div class='flex-none border-t border-neutral-100 px-4 py-3'>
  {#if failure}
    <p class='pb-2 text-caption text-error-700' role='alert'>{failure === 'signedOut'
      ? '登录后才能下载'
      : '联网后才能下载'}</p>
  {/if}
  {#if incomplete && (fill || chosen.length > 0)}
    <p class='pb-2 text-caption text-neutral-600' role='status'>
      {fill
        ? `同步完后，剩下的${remaining !== null && remaining > 0
          ? ` ${formatCount(remaining)} 首`
          : '歌'}也一起下载`
        : '还有歌没同步完，这次只下载选中的'}
    </p>
  {/if}
  <div class='flex items-center gap-2'>
    <span class='min-w-0 flex-1 truncate text-caption text-neutral-600 tabular-nums' role='status'>{chosen.length === 0
      ? selectable.length === 0 && songs.length > 0
        ? '没有可下载的歌'
        : '还没选歌'
      : `已选 ${formatCount(chosen.length)} 首 · ${sizeText}`}</span>
    {#if selectableShown.length > 0}
      <TextButton tone='neutral' size='caption' class='px-2!' onclick={toggleAll}>{allShownSelected
        ? '全不选'
        : '全选'}</TextButton>
    {/if}
    <Button
      variant='download'
      icon={CircleArrowDown}
      busy={downloadPicker.busy}
      disabled={chosen.length === 0}
      onclick={() => void submit()}
    >下载</Button>
  </div>
</div>
