<!--
  歌曲的“更多”菜单（song-menu.svelte.ts，原型 SongMenu）：下一首播放、加入播放队列、加入歌单、红心 / 取消红心，分隔线下面是下载（#38）；
  查看歌手和专辑由之后的票加。
  现在放不了的歌（无版权；断网、没登录时没下载的）、正在放的那首前两项不能选（放不进来、什么都不变）。
  没登录（曲库是 null）时没有加入歌单、红心；红心还没同步到时红心不能选。红心了的写“取消红心”，心形是珊瑚色实心（DESIGN.md Colors：珊瑚只给红心）。
  下载那一项：已下载、正在下、试听、无版权、断网时不能选，文案写明原因（downloads/view.ts 的 downloadItem）；从已下载页打开的（播放来源是已下载）换成红字“删除下载”。
  没登录时从已下载页打开：只有播放、加入播放队列、删除下载（ADR-0006）。
  点“加入歌单”关上菜单，在同一个地方打开加入歌单（AddToPlaylist），焦点交给它。
  浮动菜单、底部弹层、键盘怎么用见 MenuOverlay。登录后的骨架和没登录时的已下载页里各放一份，盖在播放页上面
-->
<script lang='ts'>
  import type { LucideIcon } from '@lucide/svelte'
  import type { SongMenuRequest } from './overlay-requests'
  import { CircleArrowDown, Heart, ListEnd, ListPlus, ListStart, Play, Trash2 } from '@lucide/svelte'
  import { getAppView } from './app-context.svelte'
  import { downloadItem, songLook } from './downloads/view'
  import Cover from './library/Cover.svelte'
  import { artistLine, langOf } from './library/view'
  import MenuOverlay from './MenuOverlay.svelte'
  import { getOverlays } from './overlay-context'
  import { currentSong } from './player/view'

  /** 浮动菜单一项的高度、分隔线占的高度和上下内边距（px）：还没画出来时按它估计高度，决定往下还是往上飘 */
  const FLOATING_ITEM = 36
  const FLOATING_SEPARATOR = 9
  const FLOATING_PADDING = 12
  /** 底部弹层一项的高度、分隔线占的高度、拉手和歌名那一块的高度（px）：还没画出来时（打开的头一帧）按它们算 */
  const SHEET_ITEM = 52
  const SHEET_SEPARATOR = 9
  const SHEET_HEAD = 112

  interface Item {
    key: string
    label: string
    icon: LucideIcon
    /** 图标的颜色：珊瑚色实心（红心了）、蜜桃枝（下载）、出错红（删除下载，文字也是红的） */
    tone?: 'hearted' | 'download' | 'destructive'
    disabled: boolean
    run: () => void
    /** 这一项上面有一条分隔线 */
    separated?: boolean
  }

  const view = getAppView()
  const { songMenu, playlistPicker } = getOverlays()

  function itemsOf(request: SongMenuRequest): Item[] {
    const { song, source } = request
    const fromDownloads = source.kind === 'downloads' && view.state.downloads.has(song.id)
    const remove: Item = { key: 'delete', label: '删除下载', icon: Trash2, tone: 'destructive', disabled: false, separated: true, run: () => void view.app.deleteDownload(song.id) }
    const unchanged = songLook(view, song).off || currentSong(view.state.player)?.id === song.id
    const queue: Item = { key: 'queue', label: '加入播放队列', icon: ListEnd, disabled: unchanged, run: () => view.app.addToQueue(source, song) }
    const library = view.state.library
    if (!library) {
      // 没登录时的已下载页：播放、加入播放队列、删除下载
      return fromDownloads
        ? [{ key: 'play', label: '播放', icon: Play, disabled: false, run: () => view.app.play(source, song.id) }, queue, remove]
        : [{ key: 'next', label: '下一首播放', icon: ListStart, disabled: unchanged, run: () => view.app.playNext(source, song) }, queue]
    }
    const hearted = library.hearts?.has(song.id) ?? false
    const download = downloadItem(view, song)
    return [
      { key: 'next', label: '下一首播放', icon: ListStart, disabled: unchanged, run: () => view.app.playNext(source, song) },
      queue,
      { key: 'add', label: '加入歌单', icon: ListPlus, disabled: false, run: () => { void songMenu.transfer(playlistPicker, request) } },
      { key: 'heart', label: hearted ? '取消红心' : '红心', icon: Heart, tone: hearted ? 'hearted' : undefined, disabled: library.hearts === null, run: () => void view.app.heart(song, !hearted) },
      fromDownloads
        ? remove
        : { key: 'download', label: download.label, icon: CircleArrowDown, tone: 'download', disabled: download.disabled, separated: true, run: () => void view.app.download(song) },
    ]
  }

  /** 转交自己消费菜单；普通动作才关闭菜单。 */
  function choose(item: Item) {
    item.run()
    if (item.key !== 'add')
      void songMenu.close()
  }

  function estimate(request: SongMenuRequest, sheet: boolean): number {
    const items = itemsOf(request)
    const separators = items.filter(item => item.separated).length
    return sheet
      ? SHEET_HEAD + items.length * SHEET_ITEM + separators * SHEET_SEPARATOR
      : FLOATING_PADDING + items.length * FLOATING_ITEM + separators * FLOATING_SEPARATOR
  }

  const ICON_TONES = { hearted: 'text-accent-600', download: 'text-secondary-800', destructive: 'text-error-700' } as const
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
    {#if item.separated}
      <div class={['my-1 h-px bg-neutral-100', sheet ? 'mx-4' : 'mx-3']} role='separator'></div>
    {/if}
    <button
      type='button'
      role='menuitem'
      tabindex='-1'
      class={[
        'w-full flex items-center rounded-lg text-left outline-none focus-visible:bg-primary-100',
        item.tone === 'destructive' ? 'text-error-700' : 'text-neutral-900',
        sheet
          ? 'h-13 gap-4 px-4 text-body disabled:opacity-45 enabled:active:bg-primary-100'
          : 'h-9 gap-3 px-3 text-label transition-colors duration-feedback disabled:(cursor-not-allowed opacity-45) mouse:enabled:hover:bg-primary-50',
      ]}
      disabled={item.disabled}
      onclick={() => choose(item)}
    >
      <item.icon
        size={sheet ? 20 : 18}
        class={['flex-none', item.tone ? ICON_TONES[item.tone] : 'text-neutral-600']}
        fill={item.tone === 'hearted' ? 'currentColor' : 'none'}
        aria-hidden='true'
      />{item.label}
    </button>
  {/each}
{/snippet}

<MenuOverlay layer={songMenu} label={({ song }) => `更多操作：${song.name}`} width='w-62' {estimate} {sheetHeader} {content} />
