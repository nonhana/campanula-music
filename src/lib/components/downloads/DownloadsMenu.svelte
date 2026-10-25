<!--
  已下载页头部的 •••（#40）：下载管理的入口。登录与否都有（下载属于这台设备，ADR-0006）；
  只有“按歌单删除下载”，打开按歌单列出有下载的歌单、再逐张确认（规则⑦）。
  没有从歌单下载的歌时这一项不可选。菜单行、行高和键盘在 MenuList（#73）。
-->
<script lang='ts'>
  import { Trash2 } from '@lucide/svelte'

  import type { MenuItem } from '../menu/menu'
  import MenuOverlay from '../menu/MenuOverlay.svelte'
  import { getOverlays } from '../overlay/overlay-context'
  import type { MenuRequest } from '../overlay/overlay-requests'
  import { getAppView } from '../shared/app-context.svelte'
  import { playlistDownloadSources } from './view'

  const view = getAppView()
  const { downloadsMenu, playlistDownloads } = getOverlays()
  // 菜单没开时不算：几千首下载不必跟着每次进度重算
  const sources = $derived(downloadsMenu.request
    ? playlistDownloadSources(view.state.downloads)
    : [])

  const itemsOf = (request: MenuRequest): MenuItem[] => [
    {
      key: 'by-playlist',
      label: '按歌单删除下载',
      leading: { kind: 'icon', icon: Trash2 },
      tone: 'destructive',
      disabled: sources.length === 0,
      closeOnChoose: false,
      run: () => void downloadsMenu.transfer(playlistDownloads, { from: request.from }),
    },
  ]
</script>

<MenuOverlay layer={downloadsMenu} label={() => '下载管理'} width='w-60' items={itemsOf} />
