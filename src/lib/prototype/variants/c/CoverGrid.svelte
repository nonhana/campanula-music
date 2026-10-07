<!-- PROTOTYPE（变体 C）：歌单 / 专辑 / 歌手 的封面网格。点一下打开那份列表（搜索框随之限定到它）。 -->
<script lang='ts'>
  import type { LibraryTab } from '$lib/prototype/nav.svelte'
  import { Heart, Lock } from '@lucide/svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { albums, artists, formatCount, langOf, playlists } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'

  interface Props {
    tab: Exclude<LibraryTab, 'liked'>
    phone?: boolean
  }

  const { tab, phone = false }: Props = $props()

  interface Tile {
    id: string
    name: string
    cover: string
    meta: string
    round?: boolean
    liked?: boolean
    locked?: boolean
  }

  const tiles = $derived.by<Tile[]>(() => {
    if (tab === 'playlists') {
      return playlists.map(p => ({
        id: p.id,
        name: p.name,
        cover: p.cover,
        meta: `${formatCount(p.count)} 首 · ${p.kind === 'collected' ? p.creator : p.kind === 'liked' ? '红心过的歌' : '自建歌单'}`,
        liked: p.kind === 'liked',
        locked: p.isPrivate,
      }))
    }
    if (tab === 'albums')
      return albums.map(a => ({ id: a.id, name: a.name, cover: a.cover, meta: `${a.artist} · ${a.year}` }))
    return artists.map(a => ({ id: a.id, name: a.name, cover: a.avatar, meta: `${formatCount(a.songCount)} 首歌曲`, round: true }))
  })
</script>

<ul class='grid' class:phone>
  {#each tiles as t (t.id)}
    <li>
      <button type='button' class='tile' class:text-center={t.round} onclick={() => {
        nav.query = ''
        nav.openPlaylist(t.id)
      }}>
        <span class='relative block'>
          <Cover cover={t.cover} class='block w-full {t.round ? 'rounded-full' : 'rounded-xl'} shadow-ambient' />
          {#if t.liked}
            <span class='badge'><Heart size={14} fill='currentColor' class='text-accent-600' aria-hidden='true' /></span>
          {/if}
        </span>
        <span class='name' lang={langOf(t.name)}>
          {#if t.locked}<Lock size={12} class='mr-1 inline-block align-[-1px] text-neutral-500' aria-label='仅自己可见' />{/if}{t.name}
        </span>
        <span class='meta' lang={langOf(t.meta)}>{t.meta}</span>
      </button>
    </li>
  {/each}
</ul>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
    gap: 28px 20px;
  }

  .grid.phone {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px 14px;
  }

  .tile {
    display: block;
    width: 100%;
    text-align: left;
    border-radius: 12px;
  }

  .tile.text-center {
    text-align: center;
  }

  .tile.text-center .name,
  .tile.text-center .meta {
    padding-inline: 8px;
  }

  .badge {
    position: absolute;
    left: 8px;
    bottom: 8px;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: #fff5f6;
  }

  .name {
    display: block;
    margin-top: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    color: #111827;
  }

  .meta {
    display: block;
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    line-height: 18px;
    color: #4b5563;
  }

  @media (hover: hover) and (pointer: fine) {
    .tile :global(img) {
      transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    .tile:hover :global(img) {
      transform: translateY(-2px);
    }
  }
</style>
