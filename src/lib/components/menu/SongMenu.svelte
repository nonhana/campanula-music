<script lang="ts">
  import { page } from '$app/state';
  import {
    CircleArrowDown,
    Disc3,
    FolderDown,
    Heart,
    ListEnd,
    ListPlus,
    ListStart,
    Play,
    Trash2,
    UserRound,
  } from '@lucide/svelte';

  import { songTitle } from '#lib/api/library.js';

  import { downloadItem } from '../downloads/view';
  import { getOverlays } from '../overlay/overlay-context';
  import type { SongMenuRequest } from '../overlay/overlay-requests';
  import { currentSong } from '../player/now';
  import { getAppView } from '../shared/app-context.svelte';
  import { artistLine, langOf } from '../shared/text';
  import { creditLink } from '../songs/credit-link';
  import { songLook } from '../songs/song-look';
  import type { MenuHeader, MenuItem } from './menu';
  import MenuOverlay from './MenuOverlay.svelte';

  const view = getAppView();
  const { stack, songMenu, artistMenu, playlistPicker, exportDialog } =
    getOverlays();

  const itemsOf = (request: SongMenuRequest): MenuItem[] => {
    const { song, source } = request;
    const fromDownloads =
      source.kind === 'downloads' && view.state.downloads.has(song.id);
    const remove: MenuItem = {
      key: 'delete',
      label: '删除下载',
      leading: { kind: 'icon', icon: Trash2 },
      tone: 'destructive',
      run: () => void view.app.deleteDownloads([song.id]),
    };
    const exportable =
      view.state.exportable && view.state.downloads.has(song.id);
    const exportItem: MenuItem = {
      key: 'export',
      label: '导出',
      leading: { kind: 'icon', icon: FolderDown },
      closeOnChoose: false,
      run: () =>
        void songMenu.transfer(exportDialog, {
          songs: [song],
          multi: false,
          from: request.from,
        }),
    };
    const group = (items: MenuItem[]): MenuItem[] =>
      items.map((item, i) => (i === 0 ? { ...item, separated: true } : item));
    const unchanged =
      songLook(view, song).off ||
      currentSong(view.state.player)?.id === song.id;
    const queue: MenuItem = {
      key: 'queue',
      label: '加入播放队列',
      leading: { kind: 'icon', icon: ListEnd },
      disabled: unchanged,
      run: () => view.app.addToQueue(source, song),
    };
    const library = view.state.library;
    if (!library) {
      return fromDownloads
        ? [
            {
              key: 'play',
              label: '播放',
              leading: { kind: 'icon', icon: Play },
              run: () => view.app.play(source, song.id),
            },
            queue,
            ...group([...(exportable ? [exportItem] : []), remove]),
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
          ];
    }
    const hearted = library.hearts?.has(song.id) ?? false;
    const download = downloadItem(view, song);
    const here = page.url.pathname;
    const artists = song.artists.flatMap(
      (artist) => creditLink('artist', artist, here) ?? [],
    );
    const album = creditLink('album', song.album, here);
    const credits = artistLine(song);
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
              run: () =>
                void (artists.length === 1
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
    ];
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
            currentPlaylistId: source.kind === 'playlist' ? source.id : null,
            from: request.from,
            anchor: request.anchor,
          });
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
      ...group(
        fromDownloads
          ? [...(exportable ? [exportItem] : []), remove, ...pages]
          : [
              {
                key: 'download',
                label: download.label,
                leading: { kind: 'icon', icon: CircleArrowDown },
                tone: 'download',
                disabled: download.disabled,
                run: () => void view.app.download(song),
              },
              ...(exportable ? [exportItem] : []),
              ...pages,
            ],
      ),
    ];
  };

  const headerOf = (
    { song }: SongMenuRequest,
    sheet: boolean,
  ): MenuHeader | null => {
    if (!sheet) return null;
    const artist = artistLine(song);
    return {
      kind: 'media',
      coverUrl: song.album.coverUrl,
      title: songTitle(song),
      titleLang: langOf(song.name),
      subtitle: artist,
      subtitleLang: langOf(artist),
    };
  };
</script>

<MenuOverlay
  layer={songMenu}
  label={({ song }) => `更多操作：${songTitle(song)}`}
  width="w-62"
  items={itemsOf}
  header={headerOf}
/>
