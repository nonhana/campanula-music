<!--
  PROTOTYPE · 手机歌曲行（照 Auxio）：封面 48、歌名、歌手、•••，没有分隔线。
  状态写在歌手前面；轻点整行播放，••• 打开底部弹层。
-->
<script lang='ts'>
  import type { Song } from '$lib/prototype/data'
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine } from '$lib/prototype/data'
  import { player } from '$lib/prototype/player.svelte'
  import { Ellipsis } from '@lucide/svelte'
  import Bars from './Bars.svelte'
  import DownloadMark from './DownloadMark.svelte'
  import Tag from './Tag.svelte'
  import { ui } from './ui.svelte'

  interface Props {
    song: Song
    onplay: () => void
  }

  const { song, onplay }: Props = $props()

  const isCurrent = $derived(player.current?.id === song.id)
</script>

<div class={['row', isCurrent && 'current', song.unavailable && 'off']}>
  <button
    type='button'
    class='hit'
    aria-label={song.unavailable ? `${song.title}，无版权，不能播放` : `播放 ${song.title}`}
    disabled={song.unavailable}
    onclick={onplay}
  ></button>
  <Cover cover={song.cover} class='cover' />
  <span class='text'>
    <span class='title-line'>
      {#if isCurrent}<Bars playing={player.playing} size={12} />{/if}
      <span class='title' lang={song.lang}>{song.title}</span>
    </span>
    <span class='sub'>
      {#if song.unavailable}<Tag kind='nocopy' />{/if}
      {#if song.trial}<Tag kind='trial' />{/if}
      <DownloadMark {song} inline />
      <span class='artist' lang={song.lang}>{artistLine(song)}</span>
    </span>
  </span>
  <button type='button' class='more' aria-label='更多操作：{song.title}' aria-haspopup='dialog' onclick={() => ui.openMenu(song, 0, 0)}>
    <Ellipsis size={20} strokeWidth={2} />
  </button>
</div>

<style>
  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 14px;
    height: 58px;
    padding: 0 4px 0 16px;
  }

  .hit {
    position: absolute;
    inset: 0;
  }

  .hit:focus-visible {
    outline-offset: -2px;
  }

  .row :global(.cover) {
    position: relative;
    flex: none;
    width: 48px;
    height: 48px;
    border-radius: 8px;
    background: #f3f4f6;
    pointer-events: none;
  }

  .text {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    pointer-events: none;
  }

  .title-line,
  .sub {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .title,
  .artist {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title {
    font-size: 15px;
    line-height: 22px;
    color: #111827;
  }

  .artist {
    font-size: 13px;
    line-height: 19px;
    color: #4b5563;
  }

  .more {
    position: relative;
    display: grid;
    flex: none;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 9999px;
    color: #4b5563;
  }

  .current .title {
    color: #206f52;
    font-weight: 500;
  }

  .off :global(.cover),
  .off .text {
    opacity: 0.45;
  }

  .row:active:not(.off) {
    background: #f9fafb;
  }
</style>
