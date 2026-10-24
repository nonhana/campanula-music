<!--
  心形按钮：红心 / 取消红心一首歌（App.heart：先改本地、立即生效，没成会自己改回并在提示条里说明）。
  没红心是空心描边（石墨色），红心了是珊瑚色实心（DESIGN.md Colors：珊瑚只给红心）；切换时新旧图标交叉淡化、新的从 85% 放大到位（反馈 120ms，
  减少动态效果时只淡入淡出）。始终可见；首次同步还没拿到红心时禁用，没登录、登录失效时不画。
  用在桌面歌曲行的状态列（36px 圆角方块，压在整行的点歌按钮上面）、桌面底栏和桌面播放页（40px 的圆）、手机迷你播放条（44px 的圆）、
  手机播放页（44px 的圆，图标大一号）
-->
<script lang='ts'>
  import { Heart } from '@lucide/svelte'

  import type { Song } from '#lib/api/library.js'
  import { songTitle } from '#lib/api/library.js'

  import { getAppView } from '../shared/app-context.svelte'
  import { iconSwap } from '../shared/motion'

  const { song, size }: { song: Song, size: 'row' | 'desktop' | 'phone' | 'phone-page' } = $props()
  const view = getAppView()
  const hearts = $derived(view.state.library?.hearts ?? null)
  const hearted = $derived(hearts?.has(song.id) ?? false)

  const LOOKS = {
    'row': { button: 'relative z-1 size-9 rounded-lg text-neutral-600', icon: 16 },
    'desktop': { button: 'size-10 rounded-full text-neutral-700', icon: 20 },
    'phone': { button: 'size-11 rounded-full text-neutral-700', icon: 20 },
    'phone-page': { button: 'size-11 rounded-full text-neutral-700 active:bg-white/60', icon: 22 },
  }
  const look = $derived(LOOKS[size])
</script>

{#if view.state.library}
  <button
    type='button'
    class={[
      'grid flex-none place-items-center transition-[background-color,color,opacity,transform] duration-feedback enabled:press disabled:(cursor-not-allowed opacity-50) mouse:enabled:hover:(bg-primary-100 text-primary-950)',
      look.button,
    ]}
    aria-label='红心《{songTitle(song)}》'
    aria-pressed={hearted}
    disabled={hearts === null}
    onclick={() => view.app.heart(song, !hearted)}
  >
    <!-- 新旧图标叠在同一格里 -->
    {#key hearted}
      <span class='grid col-start-1 row-start-1' transition:iconSwap>
        {#if hearted}
          <Heart size={look.icon} class='text-accent-600' fill='currentColor' aria-hidden='true' />
        {:else}
          <Heart size={look.icon} aria-hidden='true' />
        {/if}
      </span>
    {/key}
  </button>
{/if}
