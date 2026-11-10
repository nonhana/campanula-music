import { describe, expect, it } from 'vitest';

import { listener } from './harness/listener';
import { useWorld } from './harness/world';

const world = useWorld();
const { signInAtHearts, signInAtLikedTracks } = listener(world);

const ALBUM = {
  id: 84072830,
  song: 1409311773,
  fixture: 'library/album.missing-fields.constructed.json',
};
const PLAYLIST = {
  id: 95050200,
  detail: 'library/playlist_detail.missing-fields.constructed.json',
  songs: 'library/song_detail.missing-privilege.constructed.json',
  withoutPrivilege: 3402169401,
};

describe('宽松字段缺了', () => {
  it('专辑页：歌名、歌手、封面、时长缺了，App 拿到的这几项是 null，专辑名、封面、歌手、发行时间也是', async () => {
    const { app } = await signInAtHearts(world.device());

    await world.netease.reply(ALBUM.fixture);
    await app.openAlbum(ALBUM.id);

    const page = app.state.library?.albumPage(ALBUM.id);
    expect(page).toMatchObject({
      status: 'shown',
      content: {
        album: {
          id: ALBUM.id,
          name: null,
          coverUrl: null,
          artist: { id: null, name: null },
          publishedAt: null,
        },
      },
    });
    expect(page?.status === 'shown' && page.content.songs).toEqual([
      {
        id: ALBUM.song,
        name: null,
        artists: [],
        album: { id: ALBUM.id, name: '夜に駆ける', coverUrl: null },
        duration: null,
        downloadSize: 10442754,
        availability: 'full',
        trackNumber: 1,
        disc: '01',
        aliases: [],
        translations: ['向夜晚奔去'],
        publishedAt: null,
      },
    ]);
  });

  it('能不能播放的标记缺了：按能播，点了照常取地址放；是不是试听以播放地址的返回为准', async () => {
    const tab = await signInAtHearts(world.device());
    const { app } = tab;
    await world.netease.reply(ALBUM.fixture);
    await app.openAlbum(ALBUM.id);
    const page = app.state.library?.albumPage(ALBUM.id);
    if (page?.status !== 'shown') throw new Error('专辑页没显示');
    const [song] = page.content.songs;
    expect(app.state.playable(song)).toBe(true);

    await world.netease.reply('playback/song_url_v1.anon-trial.json');
    app.play({ kind: 'album', id: ALBUM.id }, ALBUM.song);
    await world.settle();
    tab.audio.find((audio) => !audio.paused)!.ready(30.04);
    await world.settle();
    expect(app.state.player).toMatchObject({
      status: 'playing',
      trial: true,
      duration: 30.04,
    });
  });

  it('不在曲库里的歌单：歌单名、封面、创建者缺了，App 拿到的是 null；歌曲信息里一首对不上权限信息，按能播', async () => {
    const { app } = await signInAtLikedTracks(world.device());

    await world.netease.reply(PLAYLIST.detail);
    await world.netease.reply(PLAYLIST.songs);
    await app.openPlaylist(PLAYLIST.id);

    const page = app.state.library?.neteasePlaylist(PLAYLIST.id);
    expect(page).toMatchObject({
      status: 'shown',
      content: {
        playlist: {
          id: PLAYLIST.id,
          name: null,
          coverUrl: null,
          creator: null,
        },
        total: 2,
        complete: true,
      },
    });
    const song =
      page?.status === 'shown'
        ? page.content.songs.find(
            (each) => each.id === PLAYLIST.withoutPrivilege,
          )
        : undefined;
    expect(song?.availability).toBe('full');
    expect(app.state.playable(song!)).toBe(true);
  });
});
