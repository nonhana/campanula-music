<!--
  加入歌单（song-menu.svelte.ts 的 playlistPicker，交互原型 AddToPlaylist）：从“更多”菜单打开，菜单是浮动的它就贴着同一个锚点浮出来，
  菜单是底部弹层它也是底部弹层（外壳 MenuOverlay）。最上面是“新建歌单”（#33）：打开新建（PlaylistEditor），建好接着把这首加进去。
  下面是能加进去的：我喜欢的音乐（等于红心，在最前，封面角上一颗珊瑚色实心心形）和自建歌单，按歌单列表的顺序；收藏的歌单不能编辑，不出现（GLOSSARY）。
  不能选的写明原因：从这张歌单里打开的是“当前歌单”，已经红心的歌对我喜欢的音乐是“已红心”，本机已同步的曲目里已经有这首是“已在歌单里”。
  歌单列表还没同步到时是几行骨架。选了就交给 App 加（先改本地、立即生效，成了提示“已加入”），然后关上
-->
<script lang='ts'>
  import type { Playlist } from '#lib/api/library.js'
  import type { SongMenuRequest } from './song-menu.svelte'
  import { Heart, Plus } from '@lucide/svelte'
  import { getAppView } from './app-context.svelte'
  import Cover from './library/Cover.svelte'
  import { artistLine, formatCount, langOf, playlistName } from './library/view'
  import MenuOverlay from './MenuOverlay.svelte'
  import { playlistEditor } from './playlist-edit.svelte'
  import { playlistPicker } from './song-menu.svelte'
  import Scrollbar from './ui/Scrollbar.svelte'

  /** 浮动菜单的标题、一项的高度和上下内边距（px）：还没画出来时按它们估计高度，决定往下还是往上飘 */
  const FLOATING_TITLE = 32
  const FLOATING_ITEM = 48
  const FLOATING_PADDING = 12
  /** 底部弹层一项的高度、拉手和标题那一块的高度（px）：还没画出来时（打开的头一帧）按它们算 */
  const SHEET_ITEM = 60
  const SHEET_HEAD = 100
  /** 还没拿到歌单列表时画几行骨架 */
  const LOADING_ROWS = 3

  interface Target {
    playlist: Playlist
    /** 名字下面一行：首数，不能选时是原因 */
    detail: string
    disabled: boolean
  }

  const view = getAppView()

  /** 能加进去的歌单：我喜欢的音乐在最前，然后是自建歌单；歌单列表还没同步到时是 null */
  function targetsOf({ song, source }: SongMenuRequest): Target[] | null {
    const library = view.state.library
    const playlists = library?.playlists
    if (!library || !playlists)
      return null
    const hearted = library.hearts?.has(song.id) ?? false
    const liked = playlists.filter(playlist => playlist.kind === 'liked')
    const own = playlists.filter(playlist => playlist.kind === 'own')
    return [...liked, ...own].map((playlist) => {
      const songs = library.songsOf(playlist.id)
      const count = `${formatCount(songs?.total ?? playlist.trackCount)} 首`
      const reason = source.kind === 'playlist' && source.id === playlist.id
        ? '当前歌单'
        : playlist.kind === 'liked'
        ? (hearted ? '已红心' : null)
        : songs?.songs.some(item => item.id === song.id) ? '已在歌单里' : null
      return {
        playlist,
        detail: reason ?? (playlist.kind === 'liked' ? `等于红心 · ${count}` : count),
        disabled: reason !== null,
      }
    })
  }

  function choose(playlist: Playlist, request: SongMenuRequest) {
    void view.app.addToPlaylist(playlist.id, request.song)
    playlistPicker.close()
  }

  /** 新建歌单：加入歌单关上（不把焦点还回去，交给新建），打开新建；关掉新建后焦点回到打开菜单的那个按钮 */
  function create(request: SongMenuRequest) {
    playlistPicker.request = null
    playlistEditor.open({ mode: 'new', song: request.song, from: request.from })
  }

  function estimate(request: SongMenuRequest, sheet: boolean): number {
    const targets = targetsOf(request)
    const count = targets ? targets.length + 1 : LOADING_ROWS
    return sheet ? SHEET_HEAD + count * SHEET_ITEM : FLOATING_TITLE + FLOATING_PADDING + count * FLOATING_ITEM
  }
</script>

{#snippet sheetHeader({ song }: SongMenuRequest)}
  <div class='px-4 pb-3 pt-1'>
    <p class='text-title-sm text-neutral-900 font-600'>加入歌单</p>
    <p class='truncate text-caption text-neutral-600' lang={langOf(song.name, artistLine(song))}>{song.name} · {artistLine(song)}</p>
  </div>
{/snippet}

{#snippet content(request: SongMenuRequest, sheet: boolean)}
  {@const targets = targetsOf(request)}
  {#if !sheet}
    <p class='px-2 pb-1.5 pt-1 text-caption text-neutral-600 font-500' aria-hidden='true'>加入歌单</p>
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
          <span class='relative flex flex-none'>
            <Cover url={playlist.coverUrl} size={sheet ? 44 : 36} class='rounded-md' />
            {#if playlist.kind === 'liked'}
              <span class='absolute grid size-5 place-items-center rounded-full bg-white shadow-chip -bottom-1 -right-1' aria-hidden='true'>
                <Heart size={11} class='text-accent-600' fill='currentColor' />
              </span>
            {/if}
          </span>
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

<MenuOverlay layer={playlistPicker} label={({ song }) => `加入歌单：${song.name}`} width='w-75' {estimate} {sheetHeader} {content} />
