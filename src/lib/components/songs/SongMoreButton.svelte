<!--
  歌曲行、首页歌曲格、播放页歌名旁边的 •••（DESIGN.md Song Row：始终可见，不只在悬停时出现）：打开这首歌的“更多”菜单（song-menu.svelte.ts）。
  在歌曲行里压在整行的点歌按钮上面。手机 44px 的圆，桌面歌曲行 36px、首页歌曲格 32px 的圆角方块；
  播放页里和旁边的红心键一样大：桌面 40px 的圆（desktop-page），手机 44px 的圆、图标大一号（phone-page）
-->
<script lang='ts'>
  import { Ellipsis } from '@lucide/svelte'

  import type { Song } from '#lib/api/library.js'
  import { songTitle } from '#lib/api/library.js'
  import type { PlaySource } from '#lib/api/playback.js'

  import { songMenuActions } from '../menu/song-menu.svelte'
  import { getOverlays } from '../overlay/overlay-context'

  const { song, source, size }: { song: Song, source: PlaySource, size: 'phone' | 'desktop' | 'cell' | 'desktop-page' | 'phone-page' } = $props()
  const { openSongMenuFrom } = songMenuActions()
  const { songMenu } = getOverlays()

  const LOOKS = {
    'phone': { button: 'size-11 rounded-full active:bg-primary-100', icon: 20 },
    'desktop': { button: 'size-9 rounded-lg', icon: 18 },
    'cell': { button: 'size-8 rounded-lg', icon: 17 },
    'desktop-page': { button: 'size-10 rounded-full text-neutral-700', icon: 20 },
    'phone-page': { button: 'size-11 rounded-full text-neutral-700 active:bg-white/60', icon: 22 },
  }
  const look = $derived(LOOKS[size])

  let button = $state<HTMLButtonElement>()
  const open = $derived(button !== undefined && songMenu.request?.from === button)
</script>

<button
  bind:this={button}
  type='button'
  data-more
  class={[
    'relative z-1 grid flex-none place-items-center text-neutral-600 transition-colors duration-feedback mouse:hover:(bg-primary-100 text-primary-950)',
    look.button,
    open && 'bg-primary-100 text-primary-950',
  ]}
  aria-label='更多操作：{songTitle(song)}'
  aria-haspopup='menu'
  aria-expanded={open}
  onclick={event => openSongMenuFrom(event, song, source)}
>
  <Ellipsis size={look.icon} aria-hidden='true' />
</button>
