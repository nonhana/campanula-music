<!--
  PROTOTYPE · 曲库的“歌单 / 专辑 / 歌手”三个分类：封面网格。歌单分“自建歌单”和“收藏的歌单”两组。
  点歌单进入歌单页；点专辑直接播放这张专辑；歌手只展示。
-->
<script lang='ts'>
  import type { Album } from '$lib/prototype/data'
  import type { LibraryTab } from '$lib/prototype/nav.svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { albums, artists, formatCount, formatPlays, likedSongs, playlists } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import { Lock } from '@lucide/svelte'

  interface Props {
    tab: Exclude<LibraryTab, 'liked'>
    phone?: boolean
  }

  const { tab, phone = false }: Props = $props()

  const own = playlists.filter(p => p.kind === 'own')
  const collected = playlists.filter(p => p.kind === 'collected')

  function playAlbum(album: Album) {
    const songs = likedSongs.filter(s => s.album === album.name && !s.unavailable).slice(0, album.count)
    if (songs.length)
      player.playFrom(songs, 0, { kind: 'album', name: album.name, id: album.id })
  }

  function open(id: string) {
    nav.openPlaylist(id)
    window.scrollTo(0, 0)
  }
</script>

<div class={['grids', phone && 'phone']}>
  {#if tab === 'playlists'}
    {#each [{ name: '自建歌单', list: own }, { name: '收藏的歌单', list: collected }] as group (group.name)}
      <section>
        <h2>{group.name}<span class='count tnum'>{group.list.length}</span></h2>
        <ul class='grid'>
          {#each group.list as pl (pl.id)}
            <li>
              <button type='button' class='card' onclick={() => open(pl.id)}>
                <Cover cover={pl.cover} class='art' />
                <span class='name'>
                  {#if pl.isPrivate}<Lock size={13} strokeWidth={2.25} aria-label='仅自己可见' />{/if}
                  <span>{pl.name}</span>
                </span>
                <span class='sub'>
                  <span class='tnum'>{formatCount(pl.count)}</span> 首{#if pl.kind === 'collected'} · {pl.creator}{:else if pl.downloaded} · <span class='dl'>已下载 {pl.downloaded === pl.count ? '全部' : `${pl.downloaded} 首`}</span>{/if}
                </span>
                {#if pl.playCount}<span class='sr'>播放 {formatPlays(pl.playCount)} 次</span>{/if}
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {:else if tab === 'albums'}
    <section>
      <h2>收藏的专辑<span class='count tnum'>{albums.length}</span></h2>
      <ul class='grid'>
        {#each albums as al (al.id)}
          <li>
            <button type='button' class='card' onclick={() => playAlbum(al)} aria-label='播放专辑 {al.name}'>
              <Cover cover={al.cover} class='art' />
              <span class='name'><span>{al.name}</span></span>
              <span class='sub'>{al.artist} · <span class='tnum'>{al.year}</span></span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {:else}
    <section>
      <h2>收藏的歌手<span class='count tnum'>{artists.length}</span></h2>
      <ul class='grid artists'>
        {#each artists as ar (ar.id)}
          <li class='artist'>
            <Cover cover={ar.avatar} class='art round' />
            <span class='name'><span>{ar.name}</span></span>
            <span class='sub'><span class='tnum'>{formatCount(ar.songCount)}</span> 首 · <span class='tnum'>{ar.albumCount}</span> 张专辑</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .grids {
    display: flex;
    flex-direction: column;
    gap: 36px;
  }

  h2 {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0 0 16px;
    font-size: 17px;
    line-height: 24px;
    font-weight: 600;
    color: #111827;
  }

  .count {
    font-size: 13px;
    font-weight: 400;
    color: #6b7280;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(172px, 1fr));
    gap: 28px 20px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .phone .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px 14px;
  }

  .card,
  .artist {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    text-align: left;
    border-radius: 14px;
  }

  .grids :global(.art) {
    width: 100%;
    height: auto;
    border-radius: 14px;
    background: #f3f4f6;
    box-shadow: 0 1px 2px rgb(17 24 39 / 0.04), 0 4px 16px -4px rgb(17 24 39 / 0.07);
    transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .grids :global(.art.round) {
    border-radius: 9999px;
  }

  .artist {
    align-items: center;
    text-align: center;
  }

  .artists .name {
    justify-content: center;
  }

  .name {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    max-width: 100%;
    margin-top: 10px;
    font-size: 14px;
    line-height: 21px;
    font-weight: 500;
    color: #111827;
  }

  .name > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name :global(svg) {
    flex: none;
    color: #6b7280;
  }

  .sub {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12.5px;
    line-height: 18px;
    color: #4b5563;
  }

  .dl {
    color: #b34719;
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  @media (hover: hover) and (pointer: fine) {
    .card:hover :global(.art) {
      transform: translateY(-3px);
    }
  }
</style>
