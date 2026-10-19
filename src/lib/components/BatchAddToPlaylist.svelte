<!--
  多选的“加入歌单”（#35）：目标只有“新建歌单”和其他自建歌单；当前歌单不能选，收藏的歌单、我喜欢的音乐不出现（不做批量红心）。
  鼠标是贴着工具条上那个按钮的浮动菜单，触屏是底部弹层（外壳 MenuOverlay，和歌曲的“加入歌单”一样）。
  选了就退出多选，一次请求把勾选的全部加进去；新建歌单交给 PlaylistEditor，建好接着加。
-->
<script lang='ts'>
  import type { Playlist } from '#lib/api/library.js'
  import type { BatchPickerRequest } from './batch-picker.svelte'
  import { page } from '$app/state'
  import { Plus } from '@lucide/svelte'
  import { getAppView } from './app-context.svelte'
  import { batchPicker } from './batch-picker.svelte'
  import Cover from './library/Cover.svelte'
  import { leaveSelection } from './library/playlist-selection.svelte'
  import { formatCount, langOf, playlistName } from './library/view'
  import MenuOverlay from './MenuOverlay.svelte'
  import { playlistEditor } from './playlist-edit.svelte'
  import Scrollbar from './ui/Scrollbar.svelte'

  const FLOATING_TITLE = 32
  const FLOATING_ITEM = 48
  const FLOATING_PADDING = 12
  const SHEET_ITEM = 60
  const SHEET_HEAD = 100
  const LOADING_ROWS = 3

  interface Target {
    playlist: Playlist
    detail: string
    disabled: boolean
  }

  const view = getAppView()

  /** 自建歌单（当前这张也在里面，但不能选）；歌单列表还没同步到时是 null */
  function targetsOf({ currentPlaylistId }: BatchPickerRequest): Target[] | null {
    const library = view.state.library
    const playlists = library?.playlists
    if (!library || !playlists)
      return null
    const selectable = new Set((view.app.addTargets(currentPlaylistId) ?? []).map(playlist => playlist.id))
    return playlists.filter(playlist => playlist.kind === 'own').map((playlist) => {
      const songs = library.songsOf(playlist.id)
      return {
        playlist,
        detail: selectable.has(playlist.id) ? `${formatCount(songs?.total ?? playlist.trackCount)} 首` : '当前歌单',
        disabled: !selectable.has(playlist.id),
      }
    })
  }

  /** 选了目标：收起弹层（底部弹层退掉浅路由）、退出多选，再一次把歌加进去 */
  function choose(playlist: Playlist, request: BatchPickerRequest): void {
    const songs = request.songs
    void (async () => {
      if (page.state.batchSheet) {
        await new Promise<void>((resolve) => {
          addEventListener('popstate', () => setTimeout(resolve), { once: true })
          history.back()
        })
      }
      else {
        batchPicker.request = null
      }
      leaveSelection()
      void view.app.addSongsToPlaylist(playlist.id, songs)
    })()
  }

  function create(request: BatchPickerRequest): void {
    batchPicker.request = null
    playlistEditor.open({ mode: 'new', songs: request.songs, from: request.from })
  }

  function estimate(request: BatchPickerRequest, sheet: boolean): number {
    const targets = targetsOf(request)
    const count = targets ? targets.length + 1 : LOADING_ROWS
    return sheet ? SHEET_HEAD + count * SHEET_ITEM : FLOATING_TITLE + FLOATING_PADDING + count * FLOATING_ITEM
  }
</script>

{#snippet sheetHeader({ songs }: BatchPickerRequest)}
  <div class='px-4 pb-3 pt-1'>
    <p class='text-title-sm text-neutral-900 font-600'>加入歌单<span class='ml-1.5 text-body text-neutral-600 font-400 tabular-nums'>· {formatCount(songs.length)} 首</span></p>
    <p class='text-caption text-neutral-600'>目标只能是自建歌单。</p>
  </div>
{/snippet}

{#snippet content(request: BatchPickerRequest, sheet: boolean)}
  {@const targets = targetsOf(request)}
  {#if !sheet}
    <p class='px-2 pb-1.5 pt-1 text-caption text-neutral-600 font-500' aria-hidden='true'>加入歌单 · <span class='tabular-nums'>{formatCount(request.songs.length)} 首</span></p>
  {/if}
  <div class={['overflow-y-auto overscroll-contain', sheet ? 'max-h-[60dvh]' : 'max-h-[min(360px,calc(100dvh-96px))]']}>
    <Scrollbar />
    {#if targets}
      <button
        type='button'
        role='menuitem'
        tabindex='-1'
        class={[
          'w-full flex items-center gap-3 text-left outline-none focus-visible:bg-primary-100',
          sheet ? 'h-15 rounded-xl px-4 active:bg-primary-100' : 'h-12 rounded-lg px-2 transition-colors duration-feedback mouse:hover:bg-primary-50',
        ]}
        onclick={() => create(request)}
      >
        <span class={['grid flex-none place-items-center rounded-md bg-primary-100 text-primary-950', sheet ? 'size-11' : 'size-9']} aria-hidden='true'><Plus size={18} /></span>
        <span class={['text-neutral-900 font-500', sheet ? 'text-body' : 'text-label']}>新建歌单</span>
      </button>
      {#each targets as { playlist, detail, disabled } (playlist.id)}
        <button
          type='button'
          role='menuitem'
          tabindex='-1'
          class={[
            'w-full flex items-center gap-3 text-left outline-none focus-visible:bg-primary-100',
            sheet
              ? 'h-15 rounded-xl px-4 disabled:opacity-45 enabled:active:bg-primary-100'
              : 'h-12 rounded-lg px-2 transition-colors duration-feedback disabled:(cursor-not-allowed opacity-45) mouse:enabled:hover:bg-primary-50',
          ]}
          {disabled}
          onclick={() => choose(playlist, request)}
        >
          <Cover url={playlist.coverUrl} size={sheet ? 44 : 36} class='rounded-md' />
          <span class='min-w-0 flex-1'>
            <span class={['block truncate text-neutral-900 font-500', sheet ? 'text-body' : 'text-label']} lang={langOf(playlistName(playlist))}>{playlistName(playlist)}</span>
            <span class='block truncate text-caption text-neutral-600 tabular-nums'>{detail}</span>
          </span>
        </button>
      {/each}
    {:else}
      <div role='status' aria-busy='true' aria-label='正在加载歌单'>
        {#each { length: LOADING_ROWS }, i (i)}
          <div class={['flex items-center gap-3', sheet ? 'h-15 px-4' : 'h-12 px-2']}>
            <span class={['bone flex-none rounded-md', sheet ? 'size-11' : 'size-9']}></span>
            <span class='flex flex-1 flex-col gap-2'>
              <span class='bone h-3.5 rounded-full' style:width='{[64, 48, 56][i]}%'></span>
              <span class='bone h-3 w-1/4 rounded-full'></span>
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

<MenuOverlay layer={batchPicker} label={({ songs }) => `加入歌单：${songs.length} 首`} width='w-75' {estimate} {sheetHeader} {content} />
