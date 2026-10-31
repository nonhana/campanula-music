<!--
  歌单页头部的 •••（原型 PlaylistActions）：只有自建歌单有，由浮层宿主挂载。紧凑时它先收着添加歌曲，再是编辑歌单信息、改为公开（只有隐私歌单有）、删除歌单（出错红，和上面隔一条线）；选了就关上菜单，打开对应的弹窗 / 编辑。
  多选不再收进这里：所有歌曲列表的入口都在表头最右（#82）。我喜欢的音乐不能改名、不能删，没有这个菜单；收藏的歌单用头部的“已收藏”取消收藏（DESIGN.md Layout，#30）。菜单行、行高和键盘在 MenuList（#73）。
-->
<script lang='ts'>
  import { Globe, ListPlus, Pencil, Trash2 } from '@lucide/svelte'

  import { playlistName } from '#lib/api/library.js'

  import type { MenuHeader, MenuItem } from '../menu/menu'
  import MenuOverlay from '../menu/MenuOverlay.svelte'
  import { getOverlays } from '../overlay/overlay-context'
  import type { PlaylistMenuRequest } from '../overlay/overlay-requests'
  import { getAppView } from '../shared/app-context.svelte'
  import { langOf } from '../shared/text'

  type Edit = 'info' | 'public' | 'delete'

  const view = getAppView()
  const { addSongsDialog, playlistEditor, playlistMenu } = getOverlays()

  const playlistOf = (request: PlaylistMenuRequest) => view.state.library?.playlists?.find(playlist => playlist.id === request.playlistId) ?? null

  const itemsOf = (request: PlaylistMenuRequest): MenuItem[] => {
    const playlist = playlistOf(request)
    if (playlist?.kind !== 'own')
      return []
    return [
      ...(request.compact
        ? [
          {
            key: 'add',
            label: '添加歌曲',
            leading: { kind: 'icon', icon: ListPlus } as const,
            closeOnChoose: false,
            run: () => void playlistMenu.transfer(addSongsDialog, { playlistId: request.playlistId, from: request.from }),
          },
        ]
        : []),
      {
        key: 'info',
        label: '编辑歌单信息',
        leading: { kind: 'icon', icon: Pencil },
        separated: request.compact,
        closeOnChoose: false,
        run: () => edit('info', request),
      },
      ...(playlist.private
        ? [
          {
            key: 'public',
            label: '改为公开',
            leading: { kind: 'icon', icon: Globe } as const,
            closeOnChoose: false,
            run: () => edit('public', request),
          },
        ]
        : []),
      {
        key: 'delete',
        label: '删除歌单',
        leading: { kind: 'icon', icon: Trash2 },
        tone: 'destructive',
        separated: true,
        closeOnChoose: false,
        run: () => edit('delete', request),
      },
    ]
  }

  /** 菜单关上（不把焦点还回去，交给编辑），打开对应的编辑；关掉编辑后焦点回到 ••• */
  const edit = (mode: Edit, request: PlaylistMenuRequest): void => {
    void playlistMenu.transfer(playlistEditor, { mode, playlistId: request.playlistId, from: request.from })
  }

  const headerOf = (request: PlaylistMenuRequest, sheet: boolean): MenuHeader | null => {
    const playlist = playlistOf(request)
    if (!sheet || !playlist)
      return null
    return {
      kind: 'media',
      coverUrl: playlist.coverUrl,
      title: playlistName(playlist),
      titleLang: langOf(playlist.name),
    }
  }
</script>

<MenuOverlay
  layer={playlistMenu}
  label={(request) => {
    const playlist = playlistOf(request)
    return `歌单操作：${playlist
      ? playlistName(playlist)
      : ''}`
  }}
  width='w-60'
  items={itemsOf}
  header={headerOf}
/>
