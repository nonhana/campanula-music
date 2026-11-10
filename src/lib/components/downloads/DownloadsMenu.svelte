<script lang="ts">
  import { Trash2 } from '@lucide/svelte';

  import type { MenuItem } from '../menu/menu';
  import MenuOverlay from '../menu/MenuOverlay.svelte';
  import { getOverlays } from '../overlay/overlay-context';
  import type { MenuRequest } from '../overlay/overlay-requests';
  import { getAppView } from '../shared/app-context.svelte';
  import { playlistDownloadSources } from './view';

  const view = getAppView();
  const { downloadsMenu, playlistDownloads } = getOverlays();
  const sources = $derived(
    downloadsMenu.request ? playlistDownloadSources(view.state.downloads) : [],
  );

  const itemsOf = (request: MenuRequest): MenuItem[] => [
    {
      key: 'by-playlist',
      label: '按歌单删除下载',
      leading: { kind: 'icon', icon: Trash2 },
      tone: 'destructive',
      disabled: sources.length === 0,
      closeOnChoose: false,
      run: () =>
        void downloadsMenu.transfer(playlistDownloads, { from: request.from }),
    },
  ];
</script>

<MenuOverlay
  layer={downloadsMenu}
  label={() => '下载管理'}
  width="w-60"
  items={itemsOf}
/>
