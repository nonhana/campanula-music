<script lang="ts">
  import { Plus } from '@lucide/svelte';

  import { playlistName, songTitle } from '#lib/api/library.js';
  import type { AddTarget, AddTargetBlock } from '#lib/app/library.js';

  import type { MenuHeader, MenuItem } from '../menu/menu';
  import MenuOverlay from '../menu/MenuOverlay.svelte';
  import { getOverlays } from '../overlay/overlay-context';
  import type { AddToPlaylistRequest } from '../overlay/overlay-requests';
  import { getAppView } from '../shared/app-context.svelte';
  import {
    artistLine,
    formatCount,
    formatSongCount,
    langOf,
  } from '../shared/text';

  const { playlistEditor, playlistPicker, multiSelect } = getOverlays();

  const BLOCKED: Record<AddTargetBlock, string> = {
    currentPlaylist: '当前歌单',
    alreadyHearted: '已红心',
    alreadyInPlaylist: '已在歌单里',
  };

  const view = getAppView();

  const targetsOf = (request: AddToPlaylistRequest): AddTarget[] | null => {
    const library = view.state.library;
    if (!library?.playlists) return null;
    return request.mode === 'song'
      ? view.app.addTargets({
          mode: 'song',
          song: request.song,
          currentPlaylistId: request.currentPlaylistId,
        })
      : view.app.addTargets({
          mode: 'multi',
          currentPlaylistId: request.currentPlaylistId,
        });
  };

  const itemsOf = (
    request: AddToPlaylistRequest,
  ): readonly MenuItem[] | null => {
    const targets = targetsOf(request);
    if (!targets) return null;
    return [
      {
        key: 'new',
        label: '新建歌单',
        leading: { kind: 'tile', icon: Plus },
        closeOnChoose: false,
        run: () => create(request),
      },
      ...targets.map((target): MenuItem => {
        const name = playlistName(target);
        return {
          key: String(target.id),
          label: name,
          lang: langOf(name),
          detail: target.blocked
            ? BLOCKED[target.blocked]
            : (formatSongCount(target.total) ?? undefined),
          disabled: target.blocked !== null,
          leading: {
            kind: 'cover',
            url: target.coverUrl,
            heart: target.kind === 'liked',
          },
          closeOnChoose: request.mode === 'song',
          run: () => choose(target, request),
        };
      }),
    ];
  };

  const headerOf = (
    request: AddToPlaylistRequest,
    sheet: boolean,
  ): MenuHeader => {
    if (request.mode === 'multi')
      return {
        kind: 'text',
        title: '加入歌单',
        note: `${formatCount(request.songs.length)} 首`,
      };
    if (!sheet) return { kind: 'text', title: '加入歌单' };
    const { song } = request;
    const artist = artistLine(song);
    return {
      kind: 'text',
      title: '加入歌单',
      subtitle: `${songTitle(song)} · ${artist}`,
      subtitleLang: langOf(song.name, artist),
    };
  };

  const labelOf = (request: AddToPlaylistRequest): string =>
    request.mode === 'multi'
      ? `加入歌单：${request.songs.length} 首`
      : `加入歌单：${songTitle(request.song)}`;

  const choose = (target: AddTarget, request: AddToPlaylistRequest): void => {
    if (request.mode === 'multi') {
      void multiSelect.addTo(target.id, request.songs);
      return;
    }
    void view.app.addToPlaylist(target.id, request.song);
  };

  const create = (request: AddToPlaylistRequest): void => {
    void playlistPicker.transfer(playlistEditor, {
      mode: 'new',
      songs: request.songs,
      from: request.from,
    });
  };
</script>

<MenuOverlay
  layer={playlistPicker}
  label={labelOf}
  width="w-75"
  items={itemsOf}
  header={headerOf}
  loadingLabel="正在加载歌单"
/>
