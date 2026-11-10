<script lang="ts">
  import { Globe, ListPlus, Pencil, Trash2 } from '@lucide/svelte';

  import { playlistName } from '#lib/api/library.js';

  import type { MenuHeader, MenuItem } from '../menu/menu';
  import MenuOverlay from '../menu/MenuOverlay.svelte';
  import { getOverlays } from '../overlay/overlay-context';
  import type { PlaylistMenuRequest } from '../overlay/overlay-requests';
  import { getAppView } from '../shared/app-context.svelte';
  import { langOf } from '../shared/text';

  type Edit = 'info' | 'public' | 'delete';

  const view = getAppView();
  const { addSongsDialog, playlistEditor, playlistMenu } = getOverlays();

  const playlistOf = (request: PlaylistMenuRequest) =>
    view.state.library?.playlists?.find(
      (playlist) => playlist.id === request.playlistId,
    ) ?? null;

  const itemsOf = (request: PlaylistMenuRequest): MenuItem[] => {
    const playlist = playlistOf(request);
    if (playlist?.kind !== 'own') return [];
    return [
      ...(request.compact
        ? [
            {
              key: 'add',
              label: '添加歌曲',
              leading: { kind: 'icon', icon: ListPlus } as const,
              closeOnChoose: false,
              run: () =>
                void playlistMenu.transfer(addSongsDialog, {
                  playlistId: request.playlistId,
                  from: request.from,
                }),
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
    ];
  };

  const edit = (mode: Edit, request: PlaylistMenuRequest): void => {
    void playlistMenu.transfer(playlistEditor, {
      mode,
      playlistId: request.playlistId,
      from: request.from,
    });
  };

  const headerOf = (
    request: PlaylistMenuRequest,
    sheet: boolean,
  ): MenuHeader | null => {
    const playlist = playlistOf(request);
    if (!sheet || !playlist) return null;
    return {
      kind: 'media',
      coverUrl: playlist.coverUrl,
      title: playlistName(playlist),
      titleLang: langOf(playlist.name),
    };
  };
</script>

<MenuOverlay
  layer={playlistMenu}
  label={(request) => {
    const playlist = playlistOf(request);
    return `歌单操作：${playlist ? playlistName(playlist) : ''}`;
  }}
  width="w-60"
  items={itemsOf}
  header={headerOf}
/>
