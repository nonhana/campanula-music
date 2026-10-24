<!--
  歌单页头部的 •••（原型 PlaylistActions）：只有自建歌单有，由浮层宿主挂载。
  编辑歌单信息、改为公开（只有隐私歌单有）、删除歌单（出错红，和上面隔一条线）；选了就关上菜单，打开对应的编辑（PlaylistEditor）。
  我喜欢的音乐不能改名、不能删，没有这个菜单；收藏的歌单用头部的“已收藏”取消收藏（DESIGN.md Layout，#30）。
  菜单行、行高和键盘在 MenuList（#73）。
-->
<script lang='ts'>
  import type { MenuHeader, MenuItem } from '../menu/menu'
  import type { PlaylistMenuRequest } from '../overlay/overlay-requests'
  import { Globe, Pencil, Trash2 } from '@lucide/svelte'
  import MenuOverlay from '../menu/MenuOverlay.svelte'
  import { getOverlays } from '../overlay/overlay-context'
  import { getAppView } from '../shared/app-context.svelte'
  import { langOf } from '../shared/text'

  type Edit = 'info' | 'public' | 'delete'

  const view = getAppView()
  const { playlistEditor, playlistMenu } = getOverlays()

  function playlistOf(request: PlaylistMenuRequest) {
    return view.state.library?.playlists?.find(playlist => playlist.id === request.playlistId) ?? null
  }

  function itemsOf(request: PlaylistMenuRequest): MenuItem[] {
    const playlist = playlistOf(request)
    if (playlist?.kind !== 'own')
      return []
    return [
      { key: 'info', label: '编辑歌单信息', leading: { kind: 'icon', icon: Pencil }, closeOnChoose: false, run: () => edit('info', request) },
      ...(playlist.private ? [{ key: 'public', label: '改为公开', leading: { kind: 'icon', icon: Globe } as const, closeOnChoose: false, run: () => edit('public', request) }] : []),
      { key: 'delete', label: '删除歌单', leading: { kind: 'icon', icon: Trash2 }, tone: 'destructive', separated: true, closeOnChoose: false, run: () => edit('delete', request) },
    ]
  }

  /** 菜单关上（不把焦点还回去，交给编辑），打开对应的编辑；关掉编辑后焦点回到 ••• */
  function edit(mode: Edit, request: PlaylistMenuRequest): void {
    void playlistMenu.transfer(playlistEditor, { mode, playlistId: request.playlistId, from: request.from })
  }

  /** 底部弹层的头：封面图和歌单名；浮动菜单没有 */
  function headerOf(request: PlaylistMenuRequest, sheet: boolean): MenuHeader | null {
    const playlist = playlistOf(request)
    if (!sheet || !playlist)
      return null
    return { kind: 'media', coverUrl: playlist.coverUrl, title: playlist.name, titleLang: langOf(playlist.name) }
  }
</script>

<MenuOverlay
  layer={playlistMenu}
  label={request => `歌单操作：${playlistOf(request)?.name ?? ''}`}
  width='w-60'
  items={itemsOf}
  header={headerOf}
/>
