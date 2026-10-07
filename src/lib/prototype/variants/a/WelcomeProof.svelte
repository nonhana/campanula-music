<!--
  PROTOTYPE：介绍页上的“登录后的样子”——用真实的歌曲行、封面和正在播放的那一行拼出曲库的一角（示例曲库），
  不是截图。整块不可操作（inert），读屏只读到说明文字。
-->
<script lang='ts'>
  import Cover from '$lib/prototype/Cover.svelte'
  import { formatCount, langOf, LIKED_TOTAL, likedSongs, playlists } from '$lib/prototype/data'
  import { Play } from '@lucide/svelte'
  import DesktopSongRow from './DesktopSongRow.svelte'
  import PhoneSongRow from './PhoneSongRow.svelte'

  interface Props {
    phone: boolean
  }

  const { phone }: Props = $props()

  const rows = $derived(likedSongs.slice(0, phone ? 4 : 5))
  const shelf = $derived(playlists.filter(p => p.kind !== 'liked').slice(0, phone ? 3 : 6))
  const noop = () => {}
</script>

<figure class='m-0'>
  <div class={['proof rounded-2xl bg-white shadow-ambient', phone ? 'py-3' : 'p-3']} inert>
    <div class={['flex items-center gap-3', phone ? 'h-11 px-4' : 'h-12 pl-3 pr-1']}>
      <span class={['font-600 text-neutral-900', phone ? 'text-[17px]' : 'text-[18px]']}>我喜欢的音乐</span>
      <span class='text-[13px] text-neutral-500 tnum'>{formatCount(LIKED_TOTAL)} 首</span>
      {#if !phone}
        <span class='ml-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-primary-900 pl-3.5 pr-4 text-[14px] font-500 text-white'>
          <Play size={15} fill='currentColor' aria-hidden='true' />播放全部
        </span>
      {/if}
    </div>
    <div>
      {#each rows as song, i (song.id)}
        <div class='h-14'>
          {#if phone}
            <PhoneSongRow {song} now={i === 0} onplay={noop} />
          {:else}
            <DesktopSongRow {song} n={i + 1} now={i === 0} onplay={noop} />
          {/if}
        </div>
      {/each}
    </div>

    <div class={['mt-2 border-t border-neutral-100', phone ? 'mx-4 pt-3' : 'mx-3 pt-4']}>
      <span class={['font-600 text-neutral-900', phone ? 'text-[15px]' : 'text-[16px]']}>歌单</span>
      <div class={['mt-3 grid gap-3', phone ? 'grid-cols-3' : 'grid-cols-6']}>
        {#each shelf as pl (pl.id)}
          <div class='min-w-0'>
            <Cover cover={pl.cover} class='w-full rounded-xl' />
            <span class='mt-1.5 block truncate text-[12.5px] font-500 text-neutral-900' lang={langOf(pl.name)}>{pl.name}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
  <figcaption class={['mt-3 text-[13px] leading-5 text-neutral-600', phone ? 'px-1' : 'px-1']}>
    示例曲库。登录后看到的是你自己的：我喜欢的音乐、歌单、专辑、歌手，正在播放的那一行会随进度慢慢亮起来。
  </figcaption>
</figure>
