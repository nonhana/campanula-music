<!--
  播放模式键（DESIGN.md Buttons · Icon，原型 DesktopBar、DesktopPlayer、PhonePlayer）。
  cycle：播放条上的一个键，按一下换一种（列表循环 → 单曲循环 → 随机播放），不是列表循环时图标是森林墨，看得出换过。
  播放页上分成两个开关，夹在上一首、下一首两边，开着时薄荷底：
  repeat 是循环（图标是列表循环或单曲循环，按一下在两者之间换；随机播放时它关着，按它回到列表循环），shuffle 是随机播放（再按回到列表循环）。
  换图标时新旧交叉淡化（motion.ts 的 iconSwap）
-->
<script lang='ts'>
  import type { PlayMode } from '#lib/app/player.js'
  import { Repeat, Repeat1, Shuffle } from '@lucide/svelte'
  import { getAppView } from '../shared/app-context.svelte'
  import { iconSwap } from '../shared/motion'
  import IconButton from '../ui/IconButton.svelte'
  import { NEXT_PLAY_MODE, PLAY_MODE_LABEL } from './view'

  const { kind, phone = false }: { kind: 'cycle' | 'repeat' | 'shuffle', phone?: boolean } = $props()
  const view = getAppView()
  const mode = $derived(view.state.player.mode)

  const ICONS = { loop: Repeat, one: Repeat1, shuffle: Shuffle }
  /** 开关：开着没有、按一下换成什么 */
  const toggle = $derived(
    kind === 'repeat'
      ? { on: mode !== 'shuffle', label: PLAY_MODE_LABEL[mode === 'one' ? 'one' : 'loop'], icon: mode === 'one' ? Repeat1 : Repeat, to: (mode === 'loop' ? 'one' : 'loop') as PlayMode }
      : { on: mode === 'shuffle', label: PLAY_MODE_LABEL.shuffle, icon: Shuffle, to: (mode === 'shuffle' ? 'loop' : 'shuffle') as PlayMode },
  )
</script>

{#if kind === 'cycle'}
  <IconButton
    icon={ICONS[mode]}
    label='播放模式：{PLAY_MODE_LABEL[mode]}'
    title={PLAY_MODE_LABEL[mode]}
    class={mode === 'loop' ? undefined : 'text-primary-900!'}
    onclick={() => view.app.setPlayMode(NEXT_PLAY_MODE[mode])}
  />
{:else}
  <button
    type='button'
    class={[
      'grid flex-none place-items-center rounded-full transition-[background-color,color,transform] duration-feedback press',
      phone ? 'size-11' : 'size-10',
      toggle.on ? 'bg-primary-100 text-primary-950 mouse:hover:bg-primary-200' : 'text-neutral-600 mouse:hover:(bg-primary-100 text-primary-950)',
    ]}
    aria-label={toggle.label}
    aria-pressed={toggle.on}
    title={toggle.label}
    onclick={() => view.app.setPlayMode(toggle.to)}
  >
    {#key toggle.icon}
      <span class='grid col-start-1 row-start-1' transition:iconSwap><toggle.icon size={phone ? 20 : 18} aria-hidden='true' /></span>
    {/key}
  </button>
{/if}
