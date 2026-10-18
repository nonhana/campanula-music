<!--
  歌曲的“更多”菜单（song-menu.svelte.ts，原型 SongMenu）：下一首播放、加入播放队列、加入歌单、红心 / 取消红心；下载、查看歌手和专辑由之后的票加。
  无版权的歌、正在放的那首前两项不能选（放不进来、什么都不变）。没登录（曲库是 null）时没有后两项；红心还没同步到时红心不能选。
  红心了的写“取消红心”，心形是珊瑚色实心（DESIGN.md Colors：珊瑚只给红心）。
  点“加入歌单”关上菜单，在同一个地方打开加入歌单（AddToPlaylist），焦点交给它。
  浮动菜单、底部弹层、键盘怎么用见 SongOverlay。放在 SignedInFrame 里，盖在播放页上面
-->
<script lang='ts'>
  import type { LucideIcon } from '@lucide/svelte'
  import type { SongMenuRequest } from './song-menu.svelte'
  import { Heart, ListEnd, ListPlus, ListStart } from '@lucide/svelte'
  import { getAppView } from './app-context.svelte'
  import Cover from './library/Cover.svelte'
  import { artistLine, langOf } from './library/view'
  import { currentSong } from './player/view'
  import { openPlaylistPicker, songMenu } from './song-menu.svelte'
  import SongOverlay from './SongOverlay.svelte'

  /** 浮动菜单一项的高度和上下内边距（px）：还没画出来时按它估计高度，决定往下还是往上飘 */
  const FLOATING_ITEM = 36
  const FLOATING_PADDING = 12
  /** 底部弹层一项的高度、拉手和歌名那一块的高度（px）：还没画出来时（打开的头一帧）按它们算 */
  const SHEET_ITEM = 52
  const SHEET_HEAD = 112

  interface Item {
    key: string
    label: string
    icon: LucideIcon
    /** 珊瑚色实心图标：红心了 */
    hearted?: boolean
    disabled: boolean
    run: () => void
  }

  const view = getAppView()

  function itemsOf(request: SongMenuRequest): Item[] {
    const { song, source } = request
    const unchanged = song.availability === 'noCopyright' || currentSong(view.state.player)?.id === song.id
    const items: Item[] = [
      { key: 'next', label: '下一首播放', icon: ListStart, disabled: unchanged, run: () => view.app.playNext(source, song) },
      { key: 'queue', label: '加入播放队列', icon: ListEnd, disabled: unchanged, run: () => view.app.addToQueue(source, song) },
    ]
    const library = view.state.library
    if (!library)
      return items
    const hearted = library.hearts?.has(song.id) ?? false
    return [
      ...items,
      { key: 'add', label: '加入歌单', icon: ListPlus, disabled: false, run: () => openPlaylistPicker(request) },
      { key: 'heart', label: hearted ? '取消红心' : '红心', icon: Heart, hearted, disabled: library.hearts === null, run: () => void view.app.heart(song, !hearted) },
    ]
  }

  /** 先做这一项再关菜单：“加入歌单”已经把菜单换成了加入歌单，这时菜单已经关了 */
  function choose(item: Item) {
    item.run()
    songMenu.close()
  }

  function estimate(request: SongMenuRequest, sheet: boolean): number {
    const count = itemsOf(request).length
    return sheet ? SHEET_HEAD + count * SHEET_ITEM : FLOATING_PADDING + count * FLOATING_ITEM
  }
</script>

{#snippet sheetHeader({ song }: SongMenuRequest)}
  <div class='flex items-center gap-3 px-4 pb-3 pt-1'>
    <Cover url={song.album.coverUrl} size={48} class='rounded-md' />
    <div class='min-w-0'>
      <p class='truncate text-body text-neutral-900 font-500' lang={langOf(song.name)}>{song.name}</p>
      <p class='truncate text-caption text-neutral-600' lang={langOf(artistLine(song))}>{artistLine(song)}</p>
    </div>
  </div>
{/snippet}

{#snippet content(request: SongMenuRequest, sheet: boolean)}
  {#each itemsOf(request) as item (item.key)}
    <button
      type='button'
      role='menuitem'
      tabindex='-1'
      class={[
        'w-full flex items-center rounded-lg text-left text-neutral-900 outline-none focus-visible:bg-primary-100',
        sheet
          ? 'h-13 gap-4 px-4 text-body disabled:opacity-45 enabled:active:bg-primary-100'
          : 'h-9 gap-3 px-3 text-label transition-colors duration-feedback disabled:(cursor-not-allowed opacity-45) mouse:enabled:hover:bg-primary-50',
      ]}
      disabled={item.disabled}
      onclick={() => choose(item)}
    >
      <item.icon
        size={sheet ? 20 : 18}
        class={['flex-none', item.hearted ? 'text-accent-600' : 'text-neutral-600']}
        fill={item.hearted ? 'currentColor' : 'none'}
        aria-hidden='true'
      />{item.label}
    </button>
  {/each}
{/snippet}

<SongOverlay layer={songMenu} label={({ song }) => `更多操作：${song.name}`} width='w-62' {estimate} {sheetHeader} {content} />
