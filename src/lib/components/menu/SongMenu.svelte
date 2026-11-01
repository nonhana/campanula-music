<!--
  歌曲的“更多”菜单（song-menu.svelte.ts，原型 SongMenu）：下一首播放、加入播放队列、加入歌单、红心 / 取消红心，分隔线下面是下载（#38）、导出（#79），最后是查看歌手、查看专辑（#84）。
  现在放不了的歌（无版权；断网、没登录时没下载的）、正在放的那首前两项不能选（放不进来、什么都不变）。没登录（曲库是 null）时没有加入歌单、红心；红心还没同步到时红心不能选。红心了的写“取消红心”，心形是珊瑚色实心（DESIGN.md Colors：珊瑚只给红心）。
  下载那一项：已下载、正在下、试听、无版权、断网时不能选，文案写明原因（downloads/view.ts 的 downloadItem）；从已下载页打开的（播放来源是已下载）换成红字“删除下载”。没登录时从已下载页打开：只有播放、加入播放队列、导出、删除下载（ADR-0006）。
  导出只给已下载的歌，浏览器不能选文件夹时没有（ADR-0014）；点了在同一个地方换成导出弹窗，焦点交给它。
  点“加入歌单”转交给加入歌单的选择器（同一个锚点 / 弹层），焦点交给它。菜单行、行高和键盘在 MenuList（#73）；登录后的骨架和没登录时的已下载页里各放一份，盖在播放页上面。
  查看歌手、查看专辑（照原型 A，后面同一行灰字写歌手一行、专辑名）：只有能点的才算（credit-link.ts，指向现在这一页的不算），一个都没有就没有这一项；没登录时没有。
  能点的歌手只有一位直接换页，有几位转交给歌手列表（ArtistMenu，同加入歌单的转交）。换页交给浮层栈：撤掉菜单占的历史再新开一条，返回回到打开菜单的那一页。
-->
<script lang='ts'>
  import { page } from '$app/state'
  import { CircleArrowDown, Disc3, FolderDown, Heart, ListEnd, ListPlus, ListStart, Play, Trash2, UserRound } from '@lucide/svelte'

  import { songTitle } from '#lib/api/library.js'

  import { downloadItem } from '../downloads/view'
  import { getOverlays } from '../overlay/overlay-context'
  import type { SongMenuRequest } from '../overlay/overlay-requests'
  import { currentSong } from '../player/now'
  import { getAppView } from '../shared/app-context.svelte'
  import { artistLine, langOf } from '../shared/text'
  import { creditLink } from '../songs/credit-link'
  import { songLook } from '../songs/song-look'
  import type { MenuHeader, MenuItem } from './menu'
  import MenuOverlay from './MenuOverlay.svelte'

  const view = getAppView()
  const { stack, songMenu, artistMenu, playlistPicker, exportDialog } = getOverlays()

  const itemsOf = (request: SongMenuRequest): MenuItem[] => {
    const { song, source } = request
    const fromDownloads = source.kind === 'downloads' && view.state.downloads.has(song.id)
    const remove: MenuItem = {
      key: 'delete',
      label: '删除下载',
      leading: { kind: 'icon', icon: Trash2 },
      tone: 'destructive',
      run: () => void view.app.deleteDownloads([song.id]),
    }
    const exportable = view.state.exportable && view.state.downloads.has(song.id)
    const exportItem: MenuItem = {
      key: 'export',
      label: '导出',
      leading: { kind: 'icon', icon: FolderDown },
      closeOnChoose: false,
      run: () => void songMenu.transfer(exportDialog, {
        songs: [song],
        multi: false,
        from: request.from,
      }),
    }
    /** 分隔线下面那一组：分隔线画在第一项上 */
    const group = (items: MenuItem[]): MenuItem[] => items.map((item, i) => i === 0
      ? { ...item, separated: true }
      : item)
    const unchanged = songLook(view, song).off || currentSong(view.state.player)?.id === song.id
    const queue: MenuItem = {
      key: 'queue',
      label: '加入播放队列',
      leading: { kind: 'icon', icon: ListEnd },
      disabled: unchanged,
      run: () => view.app.addToQueue(source, song),
    }
    const library = view.state.library
    if (!library) {
      // 没登录时的已下载页：播放、加入播放队列，分隔线下面导出、删除下载
      return fromDownloads
        ? [
          {
            key: 'play',
            label: '播放',
            leading: { kind: 'icon', icon: Play },
            run: () => view.app.play(source, song.id),
          },
          queue,
          ...group([
            ...(exportable
              ? [exportItem]
              : []),
            remove,
          ]),
        ]
        : [
          {
            key: 'next',
            label: '下一首播放',
            leading: { kind: 'icon', icon: ListStart },
            disabled: unchanged,
            run: () => view.app.playNext(source, song),
          },
          queue,
        ]
    }
    const hearted = library.hearts?.has(song.id) ?? false
    const download = downloadItem(view, song)
    const here = page.url.pathname
    const artists = song.artists.flatMap(artist => creditLink('artist', artist, here) ?? [])
    const album = creditLink('album', song.album, here)
    const credits = artistLine(song)
    // 查看歌手、查看专辑：换页时由浮层栈撤掉菜单（或转交出去的歌手列表），壳不要再关一次
    const pages: MenuItem[] = [
      ...(artists.length > 0
        ? [
          {
            key: 'artist',
            label: '查看歌手',
            note: credits,
            noteLang: langOf(credits),
            leading: { kind: 'icon', icon: UserRound },
            closeOnChoose: false,
            run: () => void (artists.length === 1
              ? stack.leave(artists[0]!.href)
              : songMenu.transfer(artistMenu, {
                artists,
                from: request.from,
                anchor: request.anchor,
              })),
          } satisfies MenuItem,
        ]
        : []),
      ...(album
        ? [
          {
            key: 'album',
            label: '查看专辑',
            note: album.name,
            noteLang: langOf(album.name),
            leading: { kind: 'icon', icon: Disc3 },
            closeOnChoose: false,
            run: () => void stack.leave(album.href),
          } satisfies MenuItem,
        ]
        : []),
    ]
    return [
      {
        key: 'next',
        label: '下一首播放',
        leading: { kind: 'icon', icon: ListStart },
        disabled: unchanged,
        run: () => view.app.playNext(source, song),
      },
      queue,
      {
        key: 'add',
        label: '加入歌单',
        leading: { kind: 'icon', icon: ListPlus },
        closeOnChoose: false,
        run: () => {
          void songMenu.transfer(playlistPicker, {
            mode: 'song',
            song,
            songs: [song],
            currentPlaylistId: source.kind === 'playlist'
              ? source.id
              : null,
            from: request.from,
            anchor: request.anchor,
          })
        },
      },
      {
        key: 'heart',
        label: hearted ? '取消红心' : '红心',
        leading: { kind: 'icon', icon: Heart },
        tone: hearted ? 'hearted' : undefined,
        disabled: library.hearts === null,
        run: () => void view.app.heart(song, !hearted, { notify: true }),
      },
      ...group(fromDownloads
        ? [
          ...(exportable
            ? [exportItem]
            : []),
          remove,
          ...pages,
        ]
        : [
          {
            key: 'download',
            label: download.label,
            leading: { kind: 'icon', icon: CircleArrowDown },
            tone: 'download',
            disabled: download.disabled,
            run: () => void view.app.download(song),
          },
          ...(exportable
            ? [exportItem]
            : []),
          ...pages,
        ]),
    ]
  }

  const headerOf = ({ song }: SongMenuRequest, sheet: boolean): MenuHeader | null => {
    if (!sheet)
      return null
    const artist = artistLine(song)
    return {
      kind: 'media',
      coverUrl: song.album.coverUrl,
      title: songTitle(song),
      titleLang: langOf(song.name),
      subtitle: artist,
      subtitleLang: langOf(artist),
    }
  }
</script>

<MenuOverlay
  layer={songMenu}
  label={({ song }) => `更多操作：${songTitle(song)}`}
  width='w-62'
  items={itemsOf}
  header={headerOf}
/>
