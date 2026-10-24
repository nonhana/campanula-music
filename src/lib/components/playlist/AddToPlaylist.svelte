<!--
  加入歌单（overlays.svelte.ts 登记的 playlistPicker，交互原型 AddToPlaylist）：单曲和多选共用一个选择器（#73）。
  从歌曲的“更多”菜单打开时转交同一个锚点/弹层；从多选的工具条打开时也一样。最上面是“新建歌单”（#33）：
  打开新建（PlaylistEditor），建好接着把这几首加进去。下面是我喜欢的音乐（单曲才有；封面角上一颗珊瑚色实心心形说明它就是红心）
  和自建歌单；收藏的歌单不出现。目标和不能选的理由由 App 给（addTargets），这里只写措辞：
  单曲的“当前歌单 / 已红心 / 已在歌单里”，多选按 Spec #98 只剩当前歌单以外的自建歌单。
  歌单列表还没同步到时是几行骨架。选了就交给 App 加（先改本地、立即生效），然后关上
-->
<script lang='ts'>
  import type { AddTarget, AddTargetBlock } from '#lib/app/library.js'
  import type { MenuHeader, MenuItem } from '../menu/menu'
  import type { AddToPlaylistRequest } from '../overlay/overlay-requests'
  import { Plus } from '@lucide/svelte'
  import MenuOverlay from '../menu/MenuOverlay.svelte'
  import { getOverlays } from '../overlay/overlay-context'
  import { getAppView } from '../shared/app-context.svelte'
  import { artistLine, formatCount, langOf } from '../shared/text'
  import { playlistName } from './playlist-text'

  const { playlistEditor, playlistPicker, playlistSelection } = getOverlays()

  /** 不能选的理由怎么写（答案里给的是理由本身，措辞留在这里） */
  const BLOCKED: Record<AddTargetBlock, string> = {
    currentPlaylist: '当前歌单',
    alreadyHearted: '已红心',
    alreadyInPlaylist: '已在歌单里',
  }

  const view = getAppView()

  /** App 给的目标和理由；歌单列表还没同步到时是 null（画骨架） */
  function targetsOf(request: AddToPlaylistRequest): AddTarget[] | null {
    const library = view.state.library
    if (!library?.playlists)
      return null
    return request.mode === 'song'
      ? view.app.addTargets({ mode: 'song', song: request.song, currentPlaylistId: request.currentPlaylistId })
      : view.app.addTargets({ mode: 'multi', currentPlaylistId: request.currentPlaylistId })
  }

  function itemsOf(request: AddToPlaylistRequest): readonly MenuItem[] | null {
    const targets = targetsOf(request)
    if (!targets)
      return null
    return [
      {
        key: 'new',
        label: '新建歌单',
        leading: { kind: 'tile', icon: Plus },
        closeOnChoose: false,
        run: () => create(request),
      },
      ...targets.map((target): MenuItem => {
        const name = playlistName(target)
        return {
          key: String(target.id),
          label: name,
          lang: langOf(name),
          detail: target.blocked ? BLOCKED[target.blocked] : `${formatCount(target.total)} 首`,
          disabled: target.blocked !== null,
          leading: { kind: 'cover', url: target.coverUrl, heart: target.kind === 'liked' },
          // 多选的加入由多选模块收起两层（它自己那条浅路由），壳不再关一次
          closeOnChoose: request.mode === 'song',
          run: () => choose(target, request),
        }
      }),
    ]
  }

  function headerOf(request: AddToPlaylistRequest, sheet: boolean): MenuHeader {
    if (request.mode === 'multi')
      return { kind: 'text', title: '加入歌单', note: `${formatCount(request.songs.length)} 首` }
    if (!sheet)
      return { kind: 'text', title: '加入歌单' }
    const { song } = request
    const artist = artistLine(song)
    return {
      kind: 'text',
      title: '加入歌单',
      subtitle: `${song.name} · ${artist}`,
      subtitleLang: langOf(song.name, artist),
    }
  }

  function labelOf(request: AddToPlaylistRequest): string {
    return request.mode === 'multi' ? `加入歌单：${request.songs.length} 首` : `加入歌单：${request.song.name}`
  }

  /** 选了目标：单曲交给 App 加；多选交给多选模块（收起两层、退出多选，再一次加进去） */
  function choose(target: AddTarget, request: AddToPlaylistRequest): void {
    if (request.mode === 'multi') {
      void playlistSelection.addTo(target.id, request.songs)
      return
    }
    void view.app.addToPlaylist(target.id, request.song)
  }

  /** 新建歌单：选择器关上（不把焦点还回去，交给新建），打开新建；关掉新建后焦点回到打开菜单的那个按钮 */
  function create(request: AddToPlaylistRequest): void {
    void playlistPicker.transfer(playlistEditor, { mode: 'new', songs: request.songs, from: request.from })
  }
</script>

<MenuOverlay
  layer={playlistPicker}
  label={labelOf}
  width='w-75'
  items={itemsOf}
  header={headerOf}
  loadingLabel='正在加载歌单'
/>
