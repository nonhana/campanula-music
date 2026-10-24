<!--
  圆形播放键（森林墨底、白色图标）：播放条上 44px（DESIGN.md Player Bars），桌面播放页 64px（play-button-large），手机播放页 72px。
  停着时是播放，要放时是暂停；取播放地址、缓冲超过 300ms 才淡入转圈（地址取过的歌缓冲一下就好，不在每次点歌时闪一下），
  按下去照样停下。图标之间交叉淡化，新图标从 85% 放大到位。出了问题停下时按它就是重试
-->
<script lang='ts'>
  import { LoaderCircle, Pause, Play } from '@lucide/svelte'
  import { getAppView } from '../shared/app-context.svelte'
  import { iconSwap } from '../shared/motion'
  import { DELAYS } from '../shared/motion-tokens'

  const { size = 44 }: { size?: 44 | 64 | 72 } = $props()
  const view = getAppView()
  const status = $derived(view.state.player.status)
  const busy = $derived(status === 'loading' || status === 'buffering')

  /** 取地址、缓冲已经超过 300ms */
  let slow = $state(false)
  $effect(() => {
    if (!busy)
      return
    const timer = setTimeout(() => (slow = true), DELAYS.spinner)
    return () => {
      clearTimeout(timer)
      slow = false
    }
  })
  const icon = $derived(status === 'paused' ? 'play' : busy && slow ? 'spinner' : 'pause')

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
    'grid flex-none place-items-center rounded-full bg-primary-950 text-white transition-[background-color,transform] duration-feedback press mouse:hover:bg-primary-900',
    look.button,
  ]}
  aria-label={status === 'paused' ? '播放' : busy ? '暂停（正在加载）' : '暂停'}
  onclick={() => view.app.togglePlay()}
>
  {#key icon}
    <!-- 新旧图标叠在同一格里交叉淡化 -->
    <span class='grid col-start-1 row-start-1' transition:iconSwap>
      {#if icon === 'spinner'}
        <LoaderCircle size={look.icon} class='animate-spin' aria-hidden='true' />
      {:else if icon === 'pause'}
        <Pause size={look.icon} fill='currentColor' aria-hidden='true' />
      {:else}
        <Play size={look.icon} fill='currentColor' class={look.nudge} aria-hidden='true' />
      {/if}
    </span>
  {/key}
</button>
