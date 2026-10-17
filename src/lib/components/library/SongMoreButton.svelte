<!--
  歌曲行、首页歌曲格最右边的 •••（DESIGN.md Song Row：始终可见，不只在悬停时出现）：打开这首歌的“更多”菜单（song-menu.svelte.ts）。
  压在整行的点歌按钮上面。手机 44px 的圆，桌面歌曲行 36px、首页歌曲格 32px 的圆角方块
-->
<script lang='ts'>
  import type { Song } from '#lib/api/library.js'
  import type { PlaySource } from '#lib/api/playback.js'
  import { Ellipsis } from '@lucide/svelte'
  import { openSongMenuFrom, songMenu } from '../song-menu.svelte'

  const { song, source, size }: { song: Song, source: PlaySource, size: 'phone' | 'desktop' | 'cell' } = $props()

  let button = $state<HTMLButtonElement>()
  const open = $derived(button !== undefined && songMenu.request?.from === button)
</script>

<button
  bind:this={button}
  type='button'
  class={[
    'relative z-1 grid flex-none place-items-center text-neutral-600 transition-colors duration-feedback mouse:hover:(bg-primary-100 text-primary-950)',
    size === 'phone' ? 'size-11 rounded-full active:bg-primary-100' : size === 'desktop' ? 'size-9 rounded-lg' : 'size-8 rounded-lg',
    open && 'bg-primary-100 text-primary-950',
  ]}
  aria-label='更多操作：{song.name}'
  aria-haspopup='menu'
  aria-expanded={open}
  onclick={event => openSongMenuFrom(event, song, source)}
>
  <Ellipsis size={size === 'phone' ? 20 : size === 'desktop' ? 18 : 17} aria-hidden='true' />
</button>
