<script lang="ts">
  import { Trash2 } from '@lucide/svelte';

  import type { MenuItem } from '../menu/menu.ts';
  import MenuOverlay from '../menu/MenuOverlay.svelte';
  import { getOverlays } from '../overlay/overlay-context.ts';
  import type { MenuRequest } from '../overlay/overlay-requests.ts';
  import { getAppView } from '../shared/app-context.svelte.ts';
  import { playlistDownloadSources } from './view.ts';

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
