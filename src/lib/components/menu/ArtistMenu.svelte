<!--
  歌手列表（#84，DESIGN.md Song Row）：歌曲菜单的“查看歌手”有几位能点的歌手时，在同一个位置换成它（同一个锚点 / 底部弹层，同加入歌单的转交）。
  头部写“查看歌手”，一行一位歌手，选了由浮层栈换到那一页：返回回到打开菜单的那一页，菜单不重新出现。键盘、Esc、返回照菜单壳（MenuOverlay、MenuList）的规矩。
-->
<script lang='ts'>
  import { UserRound } from '@lucide/svelte'

  import { getOverlays } from '../overlay/overlay-context'
  import type { ArtistMenuRequest } from '../overlay/overlay-requests'
  import { langOf } from '../shared/text'
  import type { MenuHeader, MenuItem } from './menu'
  import MenuOverlay from './MenuOverlay.svelte'

  const { stack, artistMenu } = getOverlays()

  const itemsOf = ({ artists }: ArtistMenuRequest): MenuItem[] => artists.map((artist, i) => ({
    key: `${i}`,
    label: artist.name,
    lang: langOf(artist.name),
    leading: { kind: 'icon', icon: UserRound },
    // 换页时由浮层栈撤掉这一层，壳不要再关一次
    closeOnChoose: false,
    run: () => void stack.leave(artist.href),
  }))

  const header: MenuHeader = { kind: 'text', title: '查看歌手' }
</script>

<MenuOverlay
  layer={artistMenu}
  label={() => '查看歌手'}
  width='w-62'
  items={itemsOf}
  header={() => header}
/>
