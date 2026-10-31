<!--
  定位到正在播放（DESIGN.md Layout · 滚动）：正在放的那一行不在屏幕内时淡入（状态档，motion.ts 的 fade），点了滚回它、焦点交给那一行；露出来以后淡出。
  40px 白色圆钮、点击范围 44px（#57），浮起阴影，`LocateFixed` 20px 石墨重；鼠标悬停薄荷雾底、森林墨图标。放在哪由调用方给（class）。
-->
<script lang='ts'>
  import { LocateFixed } from '@lucide/svelte'
  import type { ClassValue } from 'svelte/elements'

  import { fade } from '../shared/motion'
  import type { NowLocate } from '../shared/now-locate.svelte'

  interface Props {
    locate: NowLocate
    /** 主人那边另有不出现的理由（桌面播放队列面板开着） */
    hidden?: boolean
    class?: ClassValue
  }

  const { locate, hidden = false, class: klass }: Props = $props()
</script>

{#if locate.away && !hidden}
  <button
    type='button'
    class={[
      'size-10 grid place-items-center rounded-full bg-white text-neutral-700 shadow-float transition-[background-color,color,transform] duration-feedback press mouse:hover:(bg-primary-100 text-primary-950)',
      'before:absolute before:-inset-0.5 before:rounded-full before:content-empty',
      klass,
    ]}
    aria-label='定位到正在播放'
    title='定位到正在播放'
    onclick={() => locate.go()}
    transition:fade
  >
    <LocateFixed size={20} aria-hidden='true' />
  </button>
{/if}
