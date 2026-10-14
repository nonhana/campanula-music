<!--
  圆形播放键（森林墨底、白色图标）：播放条上 44px（DESIGN.md Player Bars），桌面播放页 64px（play-button-large），手机播放页 72px。
  停着时是播放，在放时是暂停；在取播放地址、缓冲时转圈，按下去照样停下。出了问题停下时按它就是重试
-->
<script lang='ts'>
  import { LoaderCircle, Pause, Play } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'

  const { size = 44 }: { size?: 44 | 64 | 72 } = $props()
  const view = getAppView()
  const status = $derived(view.state.player.status)
  const busy = $derived(status === 'loading' || status === 'buffering')
  /** 按钮大小、图标大小、播放三角往右挪多少（看起来居中） */
  const LOOKS = {
    44: { button: 'size-11', icon: 20, nudge: 'ml-0.5' },
    64: { button: 'size-16 shadow-ambient', icon: 26, nudge: 'ml-1' },
    72: { button: 'size-18 shadow-ambient', icon: 30, nudge: 'ml-1' },
  }
  const look = $derived(LOOKS[size])
</script>

<button
  class={[
    'grid flex-none place-items-center rounded-full bg-primary-950 text-white transition-[background-color,transform] duration-150 ease-out active:scale-98 mouse:hover:bg-primary-900',
    look.button,
  ]}
  aria-label={status === 'paused' ? '播放' : busy ? '暂停（正在加载）' : '暂停'}
  onclick={() => view.app.togglePlay()}
>
  {#if busy}
    <LoaderCircle size={look.icon} class='motion-safe:animate-spin' aria-hidden='true' />
  {:else if status === 'playing'}
    <Pause size={look.icon} fill='currentColor' aria-hidden='true' />
  {:else}
    <Play size={look.icon} fill='currentColor' class={look.nudge} aria-hidden='true' />
  {/if}
</button>
